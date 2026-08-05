import type { SVGProps } from 'react';

/**
 * The admin panel's icon set.
 *
 * Drawn here rather than pulled from a package, and drawn as one coherent
 * system rather than assembled: every glyph sits on the same 24×24 grid with
 * the same 1.75 stroke, round caps and round joins, so they read as a family
 * at 16px in a nav rail and at 20px in a stat tile.
 *
 * Everything inherits `currentColor`, which is what makes them work in both
 * themes and inside coloured containers without a second copy of each file.
 *
 * They replace emoji. Emoji are a different typeface on every OS — the same
 * screen shipped a flat glyph on Windows, a glossy one on macOS and a third
 * on Android — they cannot take the brand colour, and they carry a literal
 * meaning ("carp streamer" for promotions) that no user was ever meant to read.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── navigation ────────────────────────────────────────────────────────────

/** Overview — bars rising off a baseline. */
export const IconOverview = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3v16.5a1.5 1.5 0 0 0 1.5 1.5H21" />
    <path d="M7.5 16.5v-4" />
    <path d="M12 16.5v-8" />
    <path d="M16.5 16.5v-6" />
    <path d="M21 16.5v-10" />
  </Svg>
);

/** Dispatch — a delivery scooter, front wheel, rear wheel, handlebar. */
export const IconDispatch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="17.5" r="3" />
    <circle cx="18.5" cy="17.5" r="3" />
    <path d="M9 17.5h6.5" />
    <path d="M6 17.5 9.5 8h3" />
    <path d="M12 8h4l2.5 9.5" />
    <path d="M14.5 5h2.5a1 1 0 0 1 1 1v2" />
  </Svg>
);

/** Orders — a receipt with a torn foot. */
export const IconOrders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 2.5h14v18l-2.3-1.6-2.35 1.6L12 18.9l-2.35 1.6L7.3 18.9 5 20.5z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
  </Svg>
);

/** Inventory — a carton seen in three-quarter view. */
export const IconInventory = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 8.2v7.6a1.5 1.5 0 0 1-.78 1.32l-7.5 4.05a1.5 1.5 0 0 1-1.44 0l-7.5-4.05A1.5 1.5 0 0 1 3 15.8V8.2a1.5 1.5 0 0 1 .78-1.32l7.5-4.05a1.5 1.5 0 0 1 1.44 0l7.5 4.05A1.5 1.5 0 0 1 21 8.2z" />
    <path d="m3.3 7.3 8.7 4.7 8.7-4.7" />
    <path d="M12 21v-9" />
  </Svg>
);

/** Banners — a megaphone: promotion, not decoration. */
export const IconBanners = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2L15 20V4L7 8.5H5A1.5 1.5 0 0 0 3.5 10z" />
    <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M7 15.5V21" />
  </Svg>
);

/** Invoices — a document with a rupee mark on it. */
export const IconInvoices = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 2.5h7.5L19 8v13.5H6z" />
    <path d="M13.5 2.5V8H19" />
    <path d="M9.5 11.5h5" />
    <path d="M9.5 14h5" />
    <path d="M13 11.5c0 2.5-1.2 2.5-3.5 2.5l4 4" />
  </Svg>
);

/** Reports — a page leaving with a download arrow. */
export const IconReports = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 13V8l-5.5-5.5H6v19h6" />
    <path d="M13.5 2.5V8H19" />
    <path d="M17.5 15.5v6" />
    <path d="m14.75 18.75 2.75 2.75 2.75-2.75" />
  </Svg>
);

// ── brand & chrome ────────────────────────────────────────────────────────

/** Hill Express — a snow-capped ridge. Filled, because it sits on the tile. */
export const IconMountain = ({ size = 20, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path
      d="M2 19.5 9.2 6.4a1.4 1.4 0 0 1 2.45 0l2.1 3.8 1.35-2.3a1.3 1.3 0 0 1 2.26 0L22 19.5z"
      fill="currentColor"
      opacity={0.35}
    />
    <path
      d="M2 19.5 9.2 6.4a1.4 1.4 0 0 1 2.45 0L18.5 19.5z"
      fill="currentColor"
    />
    <path
      d="m7.4 12.2 1.5 1.15a.9.9 0 0 0 1.1 0l1.05-.8a.9.9 0 0 1 1.1 0l1.35 1.02"
      stroke="var(--brand-snow, #ffffff)"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z" />
  </Svg>
);

export const IconSignOut = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h8.5" />
    <path d="M18.5 12H9.5" />
    <path d="m15.5 8.5 3.5 3.5-3.5 3.5" />
  </Svg>
);

// ── KPI / status ──────────────────────────────────────────────────────────

/** Revenue. The rupee glyph drawn as a path so it takes the icon stroke. */
export const IconRupee = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 4h11" />
    <path d="M6.5 8.5h11" />
    <path d="M15 4c0 5-3.2 6.6-8.5 6.6L16.5 20" />
  </Svg>
);

export const IconTrend = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 16.5 5.5-5.5 3.5 3.5L21 5.5" />
    <path d="M15.5 5.5H21v5.5" />
  </Svg>
);

export const IconWallet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 8.5v10A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4h11.5v4.5" />
    <path d="M3.5 8.5h17" />
    <circle cx="16.5" cy="14" r="1.25" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.3 2.7 2.7L16.2 9.5" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.3l3.4 2" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.6 3.9 2.5 18a1.6 1.6 0 0 0 1.4 2.4h16.2A1.6 1.6 0 0 0 21.5 18L13.4 3.9a1.6 1.6 0 0 0-2.8 0z" />
    <path d="M12 9.5v4" />
    <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <circle cx="8.75" cy="9.75" r="1.6" />
    <path d="m3.5 17 4.7-4.7a1.6 1.6 0 0 1 2.26 0L15 16.5" />
    <path d="m13.5 15 2.4-2.4a1.6 1.6 0 0 1 2.26 0l2.3 2.3" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 15.5v3.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-3.5" />
    <path d="M12 15.5v-12" />
    <path d="m7.75 7.75 4.25-4.25 4.25 4.25" />
  </Svg>
);

/** Indeterminate progress. The only icon that moves. */
export const IconSpinner = ({ size = 20, className = '', ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={`animate-spin ${className}`}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.75} opacity={0.25} />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
    />
  </svg>
);
