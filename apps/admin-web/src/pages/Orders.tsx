import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateTime, rupees } from '../lib/format';
import { EmptyState, PageHeader, Skeleton, StatusPill, TableScroll } from '../components/ui';
import { ArtNoOrders } from '../components/illustrations';

interface Row {
  id: string;
  orderNumber: string;
  fulfillmentStatus: string;
  assignmentStatus: string;
  codDuePaise: number;
  finalPaise: number;
  itemCount: number;
  placedAt: string;
  deliveredAt: string | null;
  storeName: string;
  addressArea: string;
  customerPhone: string;
  driverName: string | null;
}

const STATUSES = [
  'ALL',
  'PLACED',
  'ACCEPTED',
  'PACKING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
];

export default function Orders() {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['admin-orders', status, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (status !== 'ALL') p.set('status', status);
      if (search.trim()) p.set('search', search.trim());
      return api<{ items: Row[]; nextCursor: string | null }>(`/admin/orders?${p}`);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Ledger"
        title="Orders"
        hint="Every order, searchable by number or customer phone"
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order number or phone…"
          className="min-h-10 min-w-64 flex-1 rounded-m border border-line2 bg-surface px-3 text-sm outline-none focus:border-moss dark:border-line2-dark dark:bg-surface-dark"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-h-10 rounded-m border border-line2 bg-surface px-3 text-sm dark:border-line2-dark dark:bg-surface-dark"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <Skeleton className="h-72" />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState art={ArtNoOrders} title="No orders match" hint="Try a different status or search." />
      ) : (
        <TableScroll>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface2 dark:bg-surface2-dark">
              <tr className="text-left text-xs uppercase tracking-wide text-ink2 dark:text-ink2-dark">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Placed</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Deliver to</th>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 text-right font-semibold">Items</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-line hover:bg-surface2 dark:border-line-dark dark:hover:bg-surface2-dark"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">{o.orderNumber}</div>
                    <div className="text-xs text-ink3 dark:text-ink3-dark">{o.customerPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-ink2 dark:text-ink2-dark">{dateTime(o.placedAt)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.fulfillmentStatus} />
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-ink2 dark:text-ink2-dark">
                    {o.addressArea}
                  </td>
                  <td className="px-4 py-3 text-ink2 dark:text-ink2-dark">
                    {o.driverName ?? <span className="text-ink3 dark:text-ink3-dark">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{o.itemCount}</td>
                  <td className="px-4 py-3 text-right font-semibold">{rupees(o.finalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
