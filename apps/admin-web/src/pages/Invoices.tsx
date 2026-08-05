import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { rupees } from '../lib/format';
import { Button, Card, EmptyState, PageHeader, Segmented, Skeleton, TableScroll } from '../components/ui';
import { ArtNoInvoices } from '../components/illustrations';

interface Row {
  id: string;
  invoiceNo: string;
  orderNumber: string;
  customer: string;
  store: string;
  invoiceDate: string;
  totalPaise: number;
  paidPaise: number;
  taxPaise: number;
  paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL';
  status: string;
  documentUrl: string | null;
}

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Short' },
  { value: 'UNPAID', label: 'Unpaid' },
] as const;

const TONE: Record<Row['paymentStatus'], string> = {
  PAID: 'bg-moss-soft text-ok dark:bg-moss-soft-dark dark:text-ok-dark',
  PARTIAL: 'bg-warning-soft text-warning dark:bg-warning-soft-dark dark:text-warning-dark',
  UNPAID: 'bg-critical-soft text-critical dark:bg-critical-soft-dark dark:text-critical-dark',
};

/**
 * The PDF sits behind a signed link rather than a bearer header, so it can
 * simply be opened in a new tab — the browser renders it inline with its own
 * PDF viewer, which beats forcing a download.
 */
async function openInvoice(id: string) {
  const { url } = await api<{ url: string }>(`/invoices/${id}/link`);
  window.open(url, '_blank', 'noopener');
}

export default function Invoices() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('ALL');
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-invoices', filter],
    queryFn: () =>
      api<{ items: Row[]; nextCursor: string | null }>(
        `/admin/invoices${filter === 'ALL' ? '' : `?paymentStatus=${filter}`}`,
      ),
  });

  const backfill = useMutation({
    mutationFn: () => api<{ issued: number; failed: number }>('/admin/invoices/backfill', { method: 'POST' }),
    onSuccess: (r) => {
      setError(r.issued === 0 ? 'Every delivered order already has an invoice.' : null);
      void qc.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
  });

  const rows = data?.items ?? [];
  const totals = rows.reduce(
    (a, r) => ({
      billed: a.billed + r.totalPaise,
      collected: a.collected + r.paidPaise,
      tax: a.tax + r.taxPaise,
    }),
    { billed: 0, collected: 0, tax: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finance"
        title="Invoices"
        hint="Issued automatically on delivery · GST serial per financial year"
        actions={
          <>
            <Segmented label="Payment status" value={filter} onChange={setFilter} options={[...FILTERS]} />
            <Button variant="secondary" onClick={() => backfill.mutate()} disabled={backfill.isPending}>
              {backfill.isPending ? 'Checking…' : 'Backfill'}
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-[color:var(--hairline)] py-3 text-sm text-ink2 dark:text-ink2-dark">
          {error}
        </Card>
      ) : null}

      {isPending ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            art={ArtNoInvoices}
            title="No invoices yet"
            hint="An invoice is issued the moment an order is delivered. Use Backfill for orders delivered earlier."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile label="Billed" value={rupees(totals.billed)} index={0} />
            <SummaryTile
              label="Collected"
              value={rupees(totals.collected)}
              hint={
                totals.billed - totals.collected > 0
                  ? `${rupees(totals.billed - totals.collected)} outstanding`
                  : 'fully reconciled'
              }
              index={1}
            />
            <SummaryTile label="Tax in period" value={rupees(totals.tax)} index={2} />
          </div>

          <TableScroll>
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--hairline)] text-left text-[11px] uppercase tracking-wide text-ink3 dark:text-ink3-dark">
                  <th className="p-3 font-bold">Invoice</th>
                  <th className="p-3 font-bold">Order</th>
                  <th className="p-3 font-bold">Customer</th>
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 text-right font-bold">Tax</th>
                  <th className="p-3 text-right font-bold">Total</th>
                  <th className="p-3 font-bold">Payment</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[color:var(--hairline)] transition last:border-0 hover:bg-surface2 dark:hover:bg-surface2-dark"
                  >
                    <td className="p-3 font-bold">{r.invoiceNo}</td>
                    <td className="p-3 text-ink2 dark:text-ink2-dark">{r.orderNumber}</td>
                    <td className="p-3 text-ink2 dark:text-ink2-dark">{r.customer}</td>
                    <td className="p-3 text-ink3 dark:text-ink3-dark">
                      {new Date(r.invoiceDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="p-3 text-right text-ink2 dark:text-ink2-dark">
                      {r.taxPaise > 0 ? rupees(r.taxPaise) : '—'}
                    </td>
                    <td className="p-3 text-right font-bold">{rupees(r.totalPaise)}</td>
                    <td className="p-3">
                      {/* label, never colour alone */}
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE[r.paymentStatus]}`}
                      >
                        {r.paymentStatus === 'PARTIAL'
                          ? `Short ${rupees(r.totalPaise - r.paidPaise)}`
                          : r.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          openInvoice(r.id).catch(() =>
                            setError('Could not open that invoice PDF.'),
                          )
                        }
                      >
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  index,
}: {
  label: string;
  value: string;
  hint?: string;
  index: number;
}) {
  return (
    <div
      className="rise rounded-[18px] border border-[color:var(--hairline)] bg-surface p-5 shadow-e1 dark:bg-surface-dark"
      style={{ '--d': `${index * 45}ms` } as React.CSSProperties}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink3 dark:text-ink3-dark">
        {label}
      </span>
      <div className="mt-2 text-[26px] font-extrabold leading-none tracking-tight">{value}</div>
      {hint ? <p className="mt-2 text-xs text-ink3 dark:text-ink3-dark">{hint}</p> : null}
    </div>
  );
}
