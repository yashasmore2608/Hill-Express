import { useId, useState } from 'react';

/**
 * Hand-built SVG charts — no chart library.
 *
 * Conventions enforced here (dataviz method):
 *  - thin recessive grid/axes, 2px lines, ≥8px hover targets
 *  - 4px rounded data-ends on bars, anchored to the baseline
 *  - 2px surface gap between adjacent fills
 *  - one y-axis, ever (two measures = two charts, never a dual axis)
 *  - text wears ink tokens; the colored mark alone carries identity
 *  - single series → no legend (the title names it)
 */

// ── shared chrome ────────────────────────────────────────────────────
export function ChartFrame({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rise rounded-[18px] border border-[color:var(--hairline)] bg-surface p-5 shadow-e1 transition duration-200 hover:shadow-e2 dark:bg-surface-dark">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-extrabold leading-tight tracking-tight">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-ink3 dark:text-ink3-dark">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function EmptyPlot({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-m border border-dashed border-line text-sm text-ink3 dark:border-line-dark dark:text-ink3-dark">
      {label}
    </div>
  );
}

// ── area + line: revenue or orders over time ─────────────────────────
interface SeriesPoint {
  date: string;
  value: number;
}

export function TimeSeriesChart({
  points,
  seriesVar = '--series-1',
  formatValue,
  formatTick,
  emptyLabel = 'No data in this range',
}: {
  points: SeriesPoint[];
  seriesVar?: string;
  formatValue: (v: number) => string;
  formatTick: (d: string) => string;
  emptyLabel?: string;
}) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <EmptyPlot label={emptyLabel} />;

  const W = 760;
  const H = 220;
  const PAD = { t: 12, r: 12, b: 26, l: 52 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) =>
    PAD.l + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${PAD.t + plotH} L${x(0)},${PAD.t + plotH} Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const active = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Time series chart"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(${seriesVar})`} stopOpacity="0.22" />
            <stop offset="100%" stopColor={`var(${seriesVar})`} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
            <text
              x={PAD.l - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--ink-3)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatValue(t)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#g${gid})`} />
        <path
          d={line}
          fill="none"
          stroke={`var(${seriesVar})`}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <g key={p.date}>
            {/* hit target wider than the mark */}
            <rect
              x={x(i) - plotW / points.length / 2}
              y={PAD.t}
              width={Math.max(12, plotW / points.length)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {hover === i ? (
              <>
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={PAD.t}
                  y2={PAD.t + plotH}
                  stroke="var(--chart-axis)"
                  strokeWidth="1"
                />
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r="5"
                  fill={`var(${seriesVar})`}
                  stroke="var(--chart-surface)"
                  strokeWidth="2"
                />
              </>
            ) : null}
          </g>
        ))}

        {points.map((p, i) =>
          i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2) ? (
            <text
              key={`t${p.date}`}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill="var(--ink-3)"
            >
              {formatTick(p.date)}
            </text>
          ) : null,
        )}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute -top-1 rounded-m border border-line bg-surface px-3 py-2 text-xs shadow-lg dark:border-line-dark dark:bg-surface-dark"
          style={{
            left: `${((x(hover!) - PAD.l) / plotW) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-ink3 dark:text-ink3-dark">{formatTick(active.date)}</div>
          <div className="tabular font-semibold">{formatValue(active.value)}</div>
        </div>
      ) : null}
    </div>
  );
}

// ── horizontal bars: top products, category revenue ──────────────────
export function BarList({
  rows,
  seriesVar = '--series-1',
  formatValue,
  emptyLabel = 'Nothing yet',
}: {
  rows: Array<{ label: string; value: number; sub?: string }>;
  seriesVar?: string;
  formatValue: (v: number) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) return <EmptyPlot label={emptyLabel} />;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm">{r.label}</span>
            {/* direct label — never a bare colored bar */}
            <span className="tabular shrink-0 text-sm font-semibold">{formatValue(r.value)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2 dark:bg-surface2-dark">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max(2, (r.value / max) * 100)}%`,
                  background: `var(${seriesVar})`,
                }}
              />
            </div>
            {r.sub ? (
              <span className="tabular w-16 shrink-0 text-right text-xs text-ink3 dark:text-ink3-dark">
                {r.sub}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── column chart: orders by hour ─────────────────────────────────────
export function ColumnChart({
  values,
  labelFor,
  seriesVar = '--series-3',
  formatValue,
}: {
  values: number[];
  labelFor: (i: number) => string;
  seriesVar?: string;
  formatValue: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return <EmptyPlot label="No orders in this range" />;

  return (
    <div>
      <div className="flex h-[150px] items-end gap-[2px]">
        {values.map((v, i) => (
          <div
            key={i}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: `${Math.max(2, (v / max) * 100)}%`,
                background: `var(${seriesVar})`,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
            {hover === i ? (
              <div className="absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-m border border-line bg-surface px-2 py-1 text-xs shadow-lg dark:border-line-dark dark:bg-surface-dark">
                <span className="text-ink3 dark:text-ink3-dark">{labelFor(i)} · </span>
                <span className="tabular font-semibold">{formatValue(v)}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink3 dark:text-ink3-dark">
        <span>{labelFor(0)}</span>
        <span>{labelFor(Math.floor(values.length / 2))}</span>
        <span>{labelFor(values.length - 1)}</span>
      </div>
    </div>
  );
}

// ── stacked status bar: order state mix ──────────────────────────────
const STATUS_VAR: Record<string, string> = {
  DELIVERED: '--status-good',
  PLACED: '--status-warning',
  ACCEPTED: '--series-3',
  PACKING: '--series-3',
  READY_FOR_PICKUP: '--series-3',
  PICKED_UP: '--status-serious',
  OUT_FOR_DELIVERY: '--status-serious',
  CANCELLED: '--ink-3',
  REJECTED: '--status-critical',
};

export function StatusMix({
  slices,
  labelFor,
}: {
  slices: Array<{ status: string; count: number }>;
  labelFor: (s: string) => string;
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <EmptyPlot label="No orders in this range" />;

  return (
    <div className="flex flex-col gap-4">
      {/* 2px surface gap between segments, per mark spec */}
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {slices.map((s) => (
          <div
            key={s.status}
            title={`${labelFor(s.status)}: ${s.count}`}
            style={{
              width: `${(s.count / total) * 100}%`,
              background: `var(${STATUS_VAR[s.status] ?? '--series-5'})`,
            }}
          />
        ))}
      </div>
      {/* legend always present for ≥2 series — identity never color-alone */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {slices.map((s) => (
          <li key={s.status} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: `var(${STATUS_VAR[s.status] ?? '--series-5'})` }}
            />
            <span className="truncate text-ink2 dark:text-ink2-dark">{labelFor(s.status)}</span>
            <span className="tabular ml-auto font-semibold">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
