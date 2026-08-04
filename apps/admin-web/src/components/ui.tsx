import type { ReactNode } from 'react';
import { statusLabel, statusTone } from '../lib/format';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-l border border-line bg-surface p-5 dark:border-line-dark dark:bg-surface-dark ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Stat tile. Per the form heuristic, a single headline number is a tile, not a
 * chart. Delta carries an arrow + sign so it never relies on colour alone.
 */
export function StatTile({
  label,
  value,
  deltaPct,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  hint?: string;
  tone?: 'default' | 'accent' | 'warning' | 'critical';
}) {
  const valueColor =
    tone === 'accent'
      ? 'text-ember dark:text-ember-dark'
      : tone === 'warning'
        ? 'text-warning dark:text-warning-dark'
        : tone === 'critical'
          ? 'text-critical dark:text-critical-dark'
          : '';

  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-ink3 dark:text-ink3-dark">
        {label}
      </span>
      <span className={`text-2xl font-extrabold tracking-tight ${valueColor}`}>{value}</span>
      <div className="flex items-center gap-2">
        {deltaPct != null ? (
          <span
            className={`text-xs font-semibold ${
              deltaPct >= 0
                ? 'text-[color:var(--status-good)]'
                : 'text-[color:var(--status-critical)]'
            }`}
          >
            {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct)}%
          </span>
        ) : null}
        {hint ? <span className="text-xs text-ink3 dark:text-ink3-dark">{hint}</span> : null}
      </div>
    </Card>
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
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${TONE_CLASS[statusTone(status)]}`}
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
    primary: 'bg-moss text-white hover:brightness-110 dark:bg-moss-dark dark:text-[#06120D]',
    secondary:
      'border border-line2 bg-surface hover:bg-surface2 dark:border-line2-dark dark:bg-surface-dark dark:hover:bg-surface2-dark',
    ghost: 'text-moss hover:bg-surface2 dark:text-moss-dark dark:hover:bg-surface2-dark',
    critical: 'bg-critical-soft text-critical dark:bg-critical-soft-dark dark:text-critical-dark',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-m px-4 text-sm font-semibold transition disabled:opacity-45 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-m bg-surface3 dark:bg-surface3-dark ${className}`} />
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="font-semibold">{title}</p>
      {hint ? <p className="text-sm text-ink3 dark:text-ink3-dark">{hint}</p> : null}
    </div>
  );
}

/** Wide content must scroll inside its own container, never the page body. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-l border border-line dark:border-line-dark">
      {children}
    </div>
  );
}
