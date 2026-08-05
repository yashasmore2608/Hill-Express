import { deflateSync } from 'node:zlib';

/**
 * A very small PDF writer — enough for a one-page tax invoice, no dependency.
 *
 * Why hand-rolled: the only thing an invoice needs is text, rules and a table.
 * Using the base-14 fonts (Helvetica) means no font file has to be embedded,
 * which is where a PDF library earns its size. This is the same call already
 * made for the SVG charts and the CSV parser.
 *
 * KNOWN LIMIT: the base-14 fonts use WinAnsiEncoding, which has no rupee sign.
 * Amounts are therefore printed as "Rs." — standard on Indian invoices, and
 * honest. Rendering "₹" would require embedding and subsetting a TrueType
 * font; that is a real upgrade, not a one-liner.
 */

type FontName = 'H' | 'HB'; // Helvetica, Helvetica-Bold

const A4 = { w: 595.28, h: 841.89 };

/** Escape the three characters that terminate or nest a PDF string literal. */
const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/**
 * WinAnsiEncoding is not Latin-1: positions 0x80–0x9F hold typographic
 * characters that Unicode puts up in the 0x2000s. Naively dropping everything
 * above U+00FF turns an em-dash into "?" — and product names, store names and
 * this codebase's own copy are full of – — ‘ ’ “ ” • …
 *
 * So: map what WinAnsi actually has, transliterate the rupee sign (absent from
 * every base-14 font — see the class doc), and only then fall back to "?" for
 * genuinely unrepresentable text such as Devanagari.
 */
const WIN_ANSI_HIGH: Record<string, string> = {
  '€': '', // euro
  '‚': '',
  'ƒ': '',
  '„': '',
  '…': '', // ellipsis
  '†': '',
  '‡': '',
  'ˆ': '',
  '‰': '',
  'Š': '',
  '‹': '',
  'Œ': '',
  'Ž': '',
  '‘': '', // left single quote
  '’': '', // right single quote / apostrophe
  '“': '', // left double quote
  '”': '', // right double quote
  '•': '', // bullet
  '–': '', // en dash
  '—': '', // em dash
  '˜': '',
  '™': '', // trademark
  'š': '',
  '›': '',
  'œ': '',
  'ž': '',
  'Ÿ': '',
  '₹': 'Rs.', // the rupee sign has no glyph in Helvetica — transliterate
};

const winAnsi = (s: string): string =>
  [...s]
    .map((ch) => {
      const mapped = WIN_ANSI_HIGH[ch];
      if (mapped !== undefined) return mapped;
      const c = ch.codePointAt(0)!;
      return c >= 0x20 && c <= 0xff ? ch : '?';
    })
    .join('');

export class Pdf {
  private ops: string[] = [];

  text(x: number, y: number, s: string, size = 10, font: FontName = 'H', gray = 0): this {
    this.ops.push(
      `BT /${font} ${size} Tf ${gray} g 1 0 0 1 ${x.toFixed(2)} ${(A4.h - y).toFixed(2)} Tm (${esc(winAnsi(s))}) Tj ET`,
    );
    return this;
  }

  /** Right-aligned text. Width is measured from the real AFM widths. */
  textRight(xRight: number, y: number, s: string, size = 10, font: FontName = 'H', gray = 0): this {
    return this.text(xRight - widthOf(s, size, font), y, s, size, font, gray);
  }

  line(x1: number, y1: number, x2: number, y2: number, gray = 0.8, w = 0.7): this {
    this.ops.push(
      `${w} w ${gray} G ${x1.toFixed(2)} ${(A4.h - y1).toFixed(2)} m ${x2.toFixed(2)} ${(A4.h - y2).toFixed(2)} l S`,
    );
    return this;
  }

  rect(x: number, y: number, w: number, h: number, gray = 0.94): this {
    this.ops.push(
      `${gray} g ${x.toFixed(2)} ${(A4.h - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
    );
    return this;
  }

  /** Fill using an RGB triple in 0–1, for the one brand-coloured band. */
  rectRgb(x: number, y: number, w: number, h: number, rgb: [number, number, number]): this {
    this.ops.push(
      `${rgb.map((c) => c.toFixed(3)).join(' ')} rg ${x.toFixed(2)} ${(A4.h - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
    );
    return this;
  }

  textRgb(x: number, y: number, s: string, size: number, font: FontName, rgb: [number, number, number]): this {
    this.ops.push(
      `BT /${font} ${size} Tf ${rgb.map((c) => c.toFixed(3)).join(' ')} rg 1 0 0 1 ${x.toFixed(2)} ${(A4.h - y).toFixed(2)} Tm (${esc(winAnsi(s))}) Tj ET`,
    );
    return this;
  }

  /** Assemble the file. Content is Flate-compressed; readers all support it. */
  build(title: string): Buffer {
    const content = deflateSync(Buffer.from(this.ops.join('\n'), 'latin1'));

    const objects: Buffer[] = [];
    const push = (body: string | Buffer) =>
      objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'));

    push('<< /Type /Catalog /Pages 2 0 R >>');
    push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] ` +
        `/Resources << /Font << /H 5 0 R /HB 6 0 R >> >> /Contents 4 0 R >>`,
    );
    push(
      Buffer.concat([
        Buffer.from(`<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'),
        content,
        Buffer.from('\nendstream', 'latin1'),
      ]),
    );
    push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    push(`<< /Title (${esc(winAnsi(title))}) /Producer (Hill Express) >>`);

    const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
    const offsets: number[] = [];
    let pos = chunks[0]!.length;

    objects.forEach((body, i) => {
      offsets.push(pos);
      const obj = Buffer.concat([
        Buffer.from(`${i + 1} 0 obj\n`, 'latin1'),
        body,
        Buffer.from('\nendobj\n', 'latin1'),
      ]);
      chunks.push(obj);
      pos += obj.length;
    });

    // xref table: byte offset of every object, exactly 20 bytes per entry.
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'latin1'));

    return Buffer.concat(chunks);
  }
}

/**
 * Helvetica advance widths (units per 1000 em) from the Adobe AFM tables, for
 * the printable ASCII range. Needed for right-aligned money columns — an
 * invoice whose totals do not line up looks fake.
 */
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
];
const HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
];

/**
 * Widths for the non-ASCII characters this document actually uses. Without
 * these the right-aligned columns drift by a few points wherever a middle dot
 * or a dash appears — small, but visible as a ragged edge.
 */
const EXTRA_WIDTH: Record<number, number> = {
  0x85: 1000, // ellipsis
  0x91: 222,
  0x92: 222, // curly quotes
  0x93: 333,
  0x94: 333,
  0x95: 350, // bullet
  0x96: 556, // en dash
  0x97: 1000, // em dash
  0xa0: 278, // nbsp
  0xb7: 278, // middle dot
};

export const widthOf = (s: string, size: number, font: FontName = 'H'): number => {
  const table = font === 'HB' ? HELV_BOLD : HELV;
  let total = 0;
  for (const ch of winAnsi(s)) {
    const c = ch.charCodeAt(0);
    total +=
      c >= 32 && c <= 122 ? (table[c - 32] ?? 556) : (EXTRA_WIDTH[c] ?? 556);
  }
  return (total * size) / 1000;
};

/** Truncate to fit a column, with an ellipsis, measured not guessed. */
export const fit = (s: string, maxWidth: number, size: number, font: FontName = 'H'): string => {
  if (widthOf(s, size, font) <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && widthOf(out + '...', size, font) > maxWidth) out = out.slice(0, -1);
  return out + '...';
};

export const PAGE = A4;
