import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { rupees } from '../lib/format';
import { EmptyState, PageHeader, Skeleton, TableScroll } from '../components/ui';

interface Row {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  storeName: string;
  packSize: string;
  pricePaise: number;
  mrpPaise: number | null;
  stockQty: number;
  reservedQty: number;
  availableQty: number;
  lowStockAt: number;
  lowStock: boolean;
  isAvailable: boolean;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
];

export default function Inventory() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['admin-products', filter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filter !== 'all') p.set('filter', filter);
      if (search.trim()) p.set('search', search.trim());
      return api<Row[]>(`/admin/products?${p}`);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Inventory"
        hint="Every product across all stores. Reserved = held by live carts."
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="min-h-10 min-w-64 flex-1 rounded-m border border-line2 bg-surface px-3 text-sm outline-none focus:border-moss dark:border-line2-dark dark:bg-surface-dark"
        />
        <div className="flex rounded-full border border-line bg-surface p-1 dark:border-line-dark dark:bg-surface-dark">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                filter === f.key
                  ? 'bg-moss text-white dark:bg-moss-dark dark:text-[#06120D]'
                  : 'text-ink2 dark:text-ink2-dark'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-72" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon="📦" title="Nothing matches" hint="Try a different filter or search." />
      ) : (
        <TableScroll>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-surface2 dark:bg-surface2-dark">
              <tr className="text-left text-xs uppercase tracking-wide text-ink2 dark:text-ink2-dark">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Stock</th>
                <th className="px-4 py-3 text-right font-semibold">Reserved</th>
                <th className="px-4 py-3 text-right font-semibold">Available</th>
                <th className="px-4 py-3 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-line hover:bg-surface2 dark:border-line-dark dark:hover:bg-surface2-dark"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ink3 dark:text-ink3-dark">
                      {p.sku ?? '—'} · {p.packSize}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink2 dark:text-ink2-dark">{p.category}</td>
                  <td className="px-4 py-3 text-right font-semibold">{rupees(p.pricePaise)}</td>
                  <td className="px-4 py-3 text-right">{p.stockQty}</td>
                  <td className="px-4 py-3 text-right text-ink3 dark:text-ink3-dark">
                    {p.reservedQty}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{p.availableQty}</td>
                  <td className="px-4 py-3">
                    {/* icon + word, never colour alone */}
                    {p.availableQty === 0 ? (
                      <span className="rounded-full bg-critical-soft px-2.5 py-1 text-[11px] font-semibold uppercase text-critical dark:bg-critical-soft-dark dark:text-critical-dark">
                        ● Out
                      </span>
                    ) : p.lowStock ? (
                      <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold uppercase text-warning dark:bg-warning-soft-dark dark:text-warning-dark">
                        ▲ Low
                      </span>
                    ) : !p.isAvailable ? (
                      <span className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-semibold uppercase text-ink2 dark:bg-surface2-dark dark:text-ink2-dark">
                        Hidden
                      </span>
                    ) : (
                      <span className="rounded-full bg-moss-soft px-2.5 py-1 text-[11px] font-semibold uppercase text-ok dark:bg-moss-soft-dark dark:text-ok-dark">
                        ✓ In stock
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
