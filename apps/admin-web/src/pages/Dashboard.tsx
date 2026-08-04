import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AdminAnalyticsDto } from '@hillexpress/shared';
import { api } from '../lib/api';
import { count, rupees, rupeesShort, shortDate, statusLabel } from '../lib/format';
import { BarList, ChartFrame, ColumnChart, StatusMix, TimeSeriesChart } from '../components/charts';
import { Card, Skeleton, StatTile } from '../components/ui';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function Dashboard() {
  const [rangeDays, setRangeDays] = useState(30);
  const { data, isPending } = useQuery({
    queryKey: ['analytics', rangeDays],
    queryFn: () => api<AdminAnalyticsDto>(`/admin/analytics?rangeDays=${rangeDays}`),
    refetchInterval: 60_000,
  });

  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="flex flex-col gap-6">
      {/* Filters in one row above the charts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-ink3 dark:text-ink3-dark">
            Last {rangeDays} days · compared with the {rangeDays} before
          </p>
        </div>
        <div
          role="group"
          aria-label="Date range"
          className="flex rounded-full border border-line bg-surface p-1 dark:border-line-dark dark:bg-surface-dark"
        >
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              aria-pressed={rangeDays === r.days}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                rangeDays === r.days
                  ? 'bg-moss text-white dark:bg-moss-dark dark:text-[#06120D]'
                  : 'text-ink2 dark:text-ink2-dark'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI tiles ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Revenue (delivered)"
          value={rupees(k.revenuePaise)}
          deltaPct={k.revenueDeltaPct}
          hint="vs previous period"
        />
        <StatTile
          label="Orders"
          value={count(k.orders)}
          deltaPct={k.ordersDeltaPct}
          hint={`${k.deliveredCount} delivered`}
        />
        <StatTile label="Avg order value" value={rupees(k.avgOrderValuePaise)} />
        <StatTile
          label="Cash with drivers"
          value={rupees(k.codOutstandingPaise)}
          tone="accent"
          hint="undeposited COD"
        />
        <StatTile
          label="Fulfilment rate"
          value={`${k.fulfilmentRatePct}%`}
          hint={`${k.cancelledCount} cancelled · ${k.rejectedCount} rejected`}
        />
        <StatTile
          label="Median delivery"
          value={k.medianDeliveryMinutes != null ? `${k.medianDeliveryMinutes} min` : '—'}
          hint={k.onTimePct != null ? `${k.onTimePct}% within promise` : 'no delivered orders yet'}
        />
        <StatTile label="Live orders" value={count(k.activeOrders)} hint="in flight now" />
        <StatTile
          label="Stock alerts"
          value={count(k.lowStockCount + k.outOfStockCount)}
          tone={k.outOfStockCount > 0 ? 'critical' : k.lowStockCount > 0 ? 'warning' : 'default'}
          hint={`${k.lowStockCount} low · ${k.outOfStockCount} out`}
        />
      </div>

      {/* ── Two measures of different scale = two charts, never a dual axis ── */}
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartFrame title="Revenue" subtitle="Delivered orders only, per day">
          <TimeSeriesChart
            points={data.series.map((p) => ({ date: p.date, value: p.revenuePaise }))}
            seriesVar="--series-1"
            formatValue={(v) => rupeesShort(v)}
            formatTick={shortDate}
          />
        </ChartFrame>

        <ChartFrame title="Orders placed" subtitle="All orders, per day">
          <TimeSeriesChart
            points={data.series.map((p) => ({ date: p.date, value: p.orders }))}
            seriesVar="--series-3"
            formatValue={(v) => count(v)}
            formatTick={shortDate}
          />
        </ChartFrame>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartFrame title="Order status mix" subtitle={`${data.kpis.orders} orders in range`}>
          <StatusMix slices={data.statusMix} labelFor={statusLabel} />
        </ChartFrame>

        <ChartFrame title="When orders arrive" subtitle="By hour of day — staff to the peak">
          <ColumnChart
            values={data.ordersByHour.map((h) => h.orders)}
            labelFor={(i) => `${String(i).padStart(2, '0')}:00`}
            seriesVar="--series-3"
            formatValue={(v) => `${v} orders`}
          />
        </ChartFrame>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartFrame title="Top products" subtitle="By delivered revenue">
          <BarList
            rows={data.topProducts.map((p) => ({
              label: p.name,
              value: p.revenuePaise,
              sub: `${p.qty} sold`,
            }))}
            seriesVar="--series-1"
            formatValue={rupees}
            emptyLabel="No delivered orders yet"
          />
        </ChartFrame>

        <ChartFrame title="Revenue by category" subtitle="Where the money comes from">
          <BarList
            rows={data.categoryRevenue.map((c) => ({
              label: c.category,
              value: c.revenuePaise,
            }))}
            seriesVar="--series-2"
            formatValue={rupees}
            emptyLabel="No delivered orders yet"
          />
        </ChartFrame>
      </div>

      {/* Table view — the accessibility fallback for every chart above */}
      <Card>
        <h3 className="mb-3 text-[15px] font-semibold">Daily breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink3 dark:border-line-dark dark:text-ink3-dark">
                <th className="py-2 pr-4 font-semibold">Date</th>
                <th className="py-2 pr-4 text-right font-semibold">Orders</th>
                <th className="py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...data.series].reverse().map((p) => (
                <tr key={p.date} className="border-b border-line last:border-0 dark:border-line-dark">
                  <td className="py-2 pr-4">{shortDate(p.date)}</td>
                  <td className="py-2 pr-4 text-right">{p.orders}</td>
                  <td className="py-2 text-right font-semibold">{rupees(p.revenuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
