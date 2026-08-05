/**
 * Empty-state spot illustrations.
 *
 * Separate from the icon set on purpose: an empty state is the largest thing
 * on an otherwise blank screen, and a 20px line icon scaled up to 120px just
 * looks like a mistake — the strokes go hairline and the shape reads as an
 * enlargement rather than a drawing. These are drawn at their real size, with
 * filled masses as well as strokes, so they hold up at 128px.
 *
 * Palette is the chart series variables, so they stay in the brand and follow
 * the theme without a second dark-mode copy.
 */

interface Props {
  /** Rendered width in px; the height follows the 160×120 aspect. */
  size?: number;
  className?: string;
}

function Frame({ size = 168, className = '', children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={(size * 120) / 160}
      viewBox="0 0 160 120"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Soft ground so the subject sits on something rather than floating. */}
      <ellipse cx="80" cy="104" rx="52" ry="7" fill="var(--series-1)" opacity="0.09" />
      {children}
    </svg>
  );
}

/** No banners yet — a phone showing an empty promo slot. */
export function ArtNoBanners(p: Props) {
  return (
    <Frame {...p}>
      <rect x="48" y="14" width="64" height="86" rx="9" fill="var(--series-1)" opacity="0.1" />
      <rect
        x="48"
        y="14"
        width="64"
        height="86"
        rx="9"
        stroke="var(--series-1)"
        strokeWidth="2"
        opacity="0.55"
      />
      <rect x="70" y="19" width="20" height="3" rx="1.5" fill="var(--series-1)" opacity="0.45" />
      {/* the empty banner slot, dashed */}
      <rect
        x="55"
        y="30"
        width="50"
        height="26"
        rx="5"
        stroke="var(--series-2)"
        strokeWidth="2"
        strokeDasharray="5 4"
        opacity="0.85"
      />
      <circle cx="66" cy="41" r="4" fill="var(--series-2)" opacity="0.55" />
      <path
        d="m58 51 8-7.5a3 3 0 0 1 4.2 0L79 52"
        stroke="var(--series-2)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* content rows below it */}
      <rect x="55" y="63" width="34" height="4" rx="2" fill="var(--series-1)" opacity="0.3" />
      <rect x="55" y="72" width="50" height="4" rx="2" fill="var(--series-1)" opacity="0.2" />
      <rect x="55" y="81" width="42" height="4" rx="2" fill="var(--series-1)" opacity="0.2" />
    </Frame>
  );
}

/** No invoices yet — a document with a paid stamp. */
export function ArtNoInvoices(p: Props) {
  return (
    <Frame {...p}>
      <path
        d="M46 16h44l20 20v66H46z"
        fill="var(--series-1)"
        opacity="0.1"
      />
      <path
        d="M46 16h44l20 20v66H46z"
        stroke="var(--series-1)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <path d="M90 16v20h20" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" opacity="0.6" />
      <rect x="57" y="48" width="38" height="4" rx="2" fill="var(--series-1)" opacity="0.3" />
      <rect x="57" y="58" width="46" height="4" rx="2" fill="var(--series-1)" opacity="0.22" />
      <rect x="57" y="68" width="30" height="4" rx="2" fill="var(--series-1)" opacity="0.22" />
      {/* rupee stamp, tilted like a real one */}
      <g transform="rotate(-14 92 82)">
        <rect
          x="74"
          y="72"
          width="36"
          height="20"
          rx="4"
          stroke="var(--series-2)"
          strokeWidth="2.2"
          opacity="0.85"
        />
        <path
          d="M84 78h9M84 82h9M90.5 78c0 4-2.6 5-6.5 5l7 6"
          stroke="var(--series-2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </g>
    </Frame>
  );
}

/** Nothing to dispatch — a scooter with an empty route ahead. */
export function ArtNoDispatch(p: Props) {
  return (
    <Frame {...p}>
      <path
        d="M22 92c14 0 14-16 30-16s16 12 30 12 18-22 34-22h22"
        stroke="var(--series-3)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 6"
        opacity="0.4"
      />
      <circle cx="52" cy="86" r="12" fill="var(--series-1)" opacity="0.12" />
      <circle cx="52" cy="86" r="12" stroke="var(--series-1)" strokeWidth="2.4" opacity="0.7" />
      <circle cx="108" cy="86" r="12" fill="var(--series-1)" opacity="0.12" />
      <circle cx="108" cy="86" r="12" stroke="var(--series-1)" strokeWidth="2.4" opacity="0.7" />
      <path
        d="M64 86h32M52 86l14-38h13M79 48h18l11 38"
        stroke="var(--series-1)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <rect x="66" y="34" width="26" height="18" rx="4" fill="var(--series-2)" opacity="0.75" />
      <path d="M79 34v18M66 43h26" stroke="var(--chart-surface)" strokeWidth="2" opacity="0.9" />
    </Frame>
  );
}

/** Nothing found — an empty carton. */
export function ArtEmptyBox(p: Props) {
  return (
    <Frame {...p}>
      <path
        d="M80 30 30 50v42l50 20 50-20V50z"
        fill="var(--series-1)"
        opacity="0.1"
      />
      <path
        d="M80 30 30 50v42l50 20 50-20V50z"
        stroke="var(--series-1)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        opacity="0.65"
      />
      <path
        d="M30 50l50 20 50-20M80 70v42"
        stroke="var(--series-1)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        opacity="0.65"
      />
      {/* open flaps, so it reads as empty rather than sealed */}
      <path
        d="M55 40 42 26M105 40l13-14"
        stroke="var(--series-2)"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </Frame>
  );
}

/** No orders — a receipt with nothing on it. */
export function ArtNoOrders(p: Props) {
  return (
    <Frame {...p}>
      <path
        d="M52 12h56v92l-7.5-5.2-7.6 5.2-7.6-5.2-7.6 5.2-7.6-5.2-7.6 5.2-7.5-5.2z"
        fill="var(--series-1)"
        opacity="0.1"
      />
      <path
        d="M52 12h56v92l-7.5-5.2-7.6 5.2-7.6-5.2-7.6 5.2-7.6-5.2-7.6 5.2-7.5-5.2z"
        stroke="var(--series-1)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <rect x="63" y="32" width="34" height="4.5" rx="2.25" fill="var(--series-1)" opacity="0.3" />
      <rect x="63" y="45" width="26" height="4.5" rx="2.25" fill="var(--series-1)" opacity="0.2" />
      <rect x="63" y="58" width="30" height="4.5" rx="2.25" fill="var(--series-1)" opacity="0.2" />
      <rect x="63" y="71" width="20" height="4.5" rx="2.25" fill="var(--series-2)" opacity="0.5" />
    </Frame>
  );
}
