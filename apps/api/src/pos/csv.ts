/**
 * Minimal RFC-4180 CSV parser: quoted fields, escaped quotes (""),
 * commas inside quotes, CRLF/LF. No dependency — the format kiranas export
 * from Excel is exactly this and nothing more exotic.
 *
 * A quote is only special at the START of a field (`atStart`). Mid-field
 * quotes are literal, so a product named `6" pipe` stays one field instead
 * of swallowing every comma that follows it.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let atStart = true; // next char begins a new field

  const endField = () => {
    row.push(field);
    field = '';
    atStart = true;
  };
  const endRow = () => {
    endField();
    // skip fully empty trailing lines
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && atStart) {
      inQuotes = true;
      atStart = false;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += ch;
      atStart = false;
    }
  }

  endRow();
  return rows;
}
