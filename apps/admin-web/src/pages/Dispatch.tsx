import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminDispatchOrderDto, AdminDriverDto } from '@hillexpress/shared';
import { ApiError, api } from '../lib/api';
import { minutesAgo, rupees } from '../lib/format';
import { Button, Card, EmptyState, PageHeader, Skeleton, StatusPill } from '../components/ui';

/**
 * FR-A-003 dispatch board. Two panes side by side — orders awaiting a driver on
 * the left, drivers with their live COD exposure on the right. This is the
 * screen that made Admin a desktop surface: assigning from a phone means
 * scroll-and-forget, and a mis-assignment costs a real delivery.
 */
export default function Dispatch() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ['dispatch'],
    queryFn: () => api<AdminDispatchOrderDto[]>('/admin/dispatch'),
    refetchInterval: 15_000,
  });
  const drivers = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: () => api<AdminDriverDto[]>('/admin/drivers'),
    refetchInterval: 30_000,
  });

  const assign = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) =>
      api(`/admin/orders/${orderId}/assign`, { method: 'POST', body: { driverId } }),
    onSuccess: () => {
      setSelected(null);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['dispatch'] });
      void qc.invalidateQueries({ queryKey: ['admin-drivers'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Assignment failed'),
  });

  const unassigned = (orders.data ?? []).filter((o) => o.assignmentStatus === 'UNASSIGNED');
  const assigned = (orders.data ?? []).filter((o) => o.assignmentStatus !== 'UNASSIGNED');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Dispatch"
        hint="Pick an order, then a driver. The COD limit is enforced at assignment."
      />

      {error ? (
        <div className="rounded-m border border-critical bg-critical-soft px-4 py-3 text-sm text-critical dark:bg-critical-soft-dark dark:text-critical-dark">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* ── awaiting a driver ── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink3 dark:text-ink3-dark">
            Awaiting a driver ({unassigned.length})
          </h2>
          {orders.isPending ? (
            <Skeleton className="h-40" />
          ) : unassigned.length === 0 ? (
            <Card>
              <EmptyState icon="✅" title="Everything is assigned" hint="New orders appear here automatically." />
            </Card>
          ) : (
            unassigned.map((o) => {
              const active = selected === o.id;
              const age = minutesAgo(o.placedAt);
              return (
                <button
                  key={o.id}
                  onClick={() => setSelected(active ? null : o.id)}
                  aria-pressed={active}
                  className={`rounded-l border p-4 text-left transition ${
                    active
                      ? 'border-moss bg-moss-soft dark:border-moss-dark dark:bg-moss-soft-dark'
                      : 'border-line bg-surface hover:border-line2 dark:border-line-dark dark:bg-surface-dark'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{o.orderNumber}</span>
                      <span className="text-sm text-ink2 dark:text-ink2-dark">{o.addressArea}</span>
                      <span className="text-xs text-ink3 dark:text-ink3-dark">
                        {o.storeName} · {o.itemCount} items · {age} min ago
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill status={o.fulfillmentStatus} />
                      <span className="tabular text-sm font-bold text-ember dark:text-ember-dark">
                        {rupees(o.codDuePaise)}
                      </span>
                    </div>
                  </div>
                  {active ? (
                    <p className="mt-3 text-xs font-semibold text-moss dark:text-moss-dark">
                      Now pick a driver →
                    </p>
                  ) : null}
                </button>
              );
            })
          )}

          {assigned.length > 0 ? (
            <>
              <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink3 dark:text-ink3-dark">
                In flight ({assigned.length})
              </h2>
              {assigned.map((o) => (
                <Card key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{o.orderNumber}</span>
                    <span className="text-xs text-ink3 dark:text-ink3-dark">
                      {o.driverName ?? 'Driver'} · {o.addressArea}
                    </span>
                  </div>
                  <StatusPill status={o.fulfillmentStatus} />
                </Card>
              ))}
            </>
          ) : null}
        </div>

        {/* ── drivers ── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink3 dark:text-ink3-dark">
            Drivers
          </h2>
          {drivers.isPending ? (
            <Skeleton className="h-40" />
          ) : (
            (drivers.data ?? []).map((d) => {
              const pct = Math.min(100, (d.codOutstandingPaise / d.codLimitPaise) * 100);
              const offDuty = d.status === 'OFFLINE' || d.status === 'SUSPENDED';
              return (
                <Card key={d.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-xs text-ink3 dark:text-ink3-dark">
                        {d.phone} · {d.activeOrders} active
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        offDuty
                          ? 'bg-surface2 text-ink2 dark:bg-surface2-dark dark:text-ink2-dark'
                          : 'bg-moss-soft text-ok dark:bg-moss-soft-dark dark:text-ok-dark'
                      }`}
                    >
                      {d.status.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink3 dark:text-ink3-dark">Cash in hand</span>
                      <span className="tabular font-semibold">
                        {rupees(d.codOutstandingPaise)} / {rupees(d.codLimitPaise)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface3 dark:bg-surface3-dark">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.max(2, pct)}%`,
                          background:
                            pct > 80 ? 'var(--status-critical)' : 'var(--series-2)',
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    variant={selected ? 'primary' : 'secondary'}
                    disabled={!selected || offDuty || assign.isPending}
                    onClick={() =>
                      selected && assign.mutate({ orderId: selected, driverId: d.id })
                    }
                  >
                    {offDuty
                      ? 'Off duty'
                      : selected
                        ? `Assign to ${d.name.split(' ')[0]}`
                        : 'Select an order first'}
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
