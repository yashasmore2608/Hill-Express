import type { ReactNode } from 'react';
import { statusLabel, statusTone } from '../lib/format';

/**
 * Surface. Elevation comes from a tinted shadow plus a hairline, never from a
 * heavy border — a 1px grey box around everything is what makes a dashboard
 * look like a spreadsheet.
 */
export function Card({
  children,
  className = '',
  interactive = false,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  /** Lifts on hover. Only for cards that are actually clickable. */
  interactive?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border border-[color:var(--hairline)] bg-surface shadow-e1 dark:bg-surface-dark ${
        padded ? 'p-5' : ''
      } ${
        interactive
          ? 'transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-e2'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Page title block. Consistent eyebrow → title → hint on every screen. */
export function PageHeader({
  eyebrow,
  title,
  hint,
  actions,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--series-1)]">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight lg:text-3xl">
          {title}
        </h1>
        {hint ? <p className="mt-0.5 text-sm text-ink3 dark:text-ink3-dark">{hint}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const TONE_RAIL: Record<string, string> = {
  default: 'var(--series-1)',
  accent: 'var(--series-2)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
};

/**
 * Stat tile. A single headline number is a tile, not a chart.
 *
 * The delta carries an arrow AND a sign, and the tone rail is paired with an
 * icon — colour never has to be read on its own.
 */
export function StatTile({
  label,
  value,
  deltaPct,
  hint,
  icon,
  tone = 'default',
  index = 0,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  hint?: string;
  icon?: string;
  tone?: 'default' | 'accent' | 'warning' | 'critical';
  /** Position in the grid — drives the entrance stagger only. */
  index?: number;
}) {
  const rail = TONE_RAIL[tone];
  const valueColor =
    tone === 'accent'
      ? 'text-ember dark:text-ember-dark'
      : tone === 'warning'
        ? 'text-warning dark:text-warning-dark'
        : tone === 'critical'
          ? 'text-critical dark:text-critical-dark'
          : '';

  return (
    <div
      className="rise group relative overflow-hidden rounded-[18px] border border-[color:var(--hairline)] bg-surface p-5 shadow-e1 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-e2 dark:bg-surface-dark"
      style={{ '--d': `${Math.min(index, 7) * 45}ms` } as React.CSSProperties}
    >
      {/* Tone rail — the tile's identity at a glance, down the leading edge. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: rail }}
      />
      {/* Faint tint that blooms on hover, tied to the same tone. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.16]"
        style={{ background: rail }}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink3 dark:text-ink3-dark">
          {label}
        </span>
        {icon ? (
          <span aria-hidden className="text-base opacity-70">
            {icon}
          </span>
        ) : null}
      </div>

      <div className={`mt-2 text-[28px] font-extrabold leading-none tracking-tight ${valueColor}`}>
        {value}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {deltaPct != null ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{
              color: deltaPct >= 0 ? 'var(--status-good)' : 'var(--status-critical)',
              background: deltaPct >= 0 ? 'rgba(12,163,12,.1)' : 'rgba(192,57,47,.1)',
            }}
          >
            {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct)}%
          </span>
        ) : null}
        {hint ? <span className="text-xs text-ink3 dark:text-ink3-dark">{hint}</span> : null}
      </div>
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  good: 'bg-moss-soft text-ok dark:bg-moss-soft-dark dark:text-ok-dark',
  warning: 'bg-warning-soft text-warning dark:bg-warning-soft-dark dark:text-warning-dark',
  serious: 'bg-ember-soft text-ember dark:bg-ember-soft-dark dark:text-ember-dark',
  critical: 'bg-critical-soft text-critical dark:bg-critical-soft-dark dark:text-critical-dark',
  neutral: 'bg-surface2 text-ink2 dark:bg-surface2-dark dark:text-ink2-dark',
};

/** Status always ships with its label — colour never carries meaning alone. */
export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE_CLASS[statusTone(status)]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'critical';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary:
      'text-white shadow-e1 hover:shadow-e2 hover:brightness-[1.07] dark:text-[#04120C] [background:var(--brand-grad)]',
    secondary:
      'border border-[color:var(--hairline)] bg-surface shadow-e1 hover:bg-surface2 dark:bg-surface-dark dark:hover:bg-surface2-dark',
    ghost: 'text-moss hover:bg-surface2 dark:text-moss-dark dark:hover:bg-surface2-dark',
    critical:
      'bg-critical-soft text-critical hover:brightness-95 dark:bg-critical-soft-dark dark:text-critical-dark',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] px-4 text-sm font-bold transition duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/** Segmented control — date ranges, theme, any 2–4 exclusive choice. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: Array<{ value: T; label: string; icon?: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex gap-1 rounded-full border border-[color:var(--hairline)] bg-surface2 p-1 shadow-e1 dark:bg-surface2-dark ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition duration-150 ${
              on
                ? 'bg-surface text-ink shadow-e1 dark:bg-surface-dark dark:text-ink-dark'
                : 'text-ink3 hover:text-ink2 dark:text-ink3-dark dark:hover:text-ink2-dark'
            }`}
          >
            {o.icon ? <span aria-hidden>{o.icon}</span> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Loading placeholder with a travelling sheen rather than a flat pulse. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[14px] bg-surface3 dark:bg-surface3-dark ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent)',
          animation: 'sheen 1.5s infinite',
        }}
      />
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span
        aria-hidden
        className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-surface2 text-3xl dark:bg-surface2-dark"
      >
        {icon}
      </span>
      <p className="font-bold">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-ink3 dark:text-ink3-dark">{hint}</p> : null}
    </div>
  );
}

/** Wide content must scroll inside its own container, never the page body. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-[color:var(--hairline)] bg-surface shadow-e1 dark:bg-surface-dark">
      {children}
    </div>
  );
}
