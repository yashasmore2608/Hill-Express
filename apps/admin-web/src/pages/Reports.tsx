import { useState } from 'react';
import { downloadCsv } from '../lib/api';
import { Button, Card } from '../components/ui';

/** FR-A-007 — the reason Admin is a desktop surface. */
const REPORTS = [
  {
    kind: 'orders',
    icon: '🧾',
    title: 'Daily orders',
    hint: 'Every order with status, timings, driver, money and actual-vs-promised delivery minutes.',
  },
  {
    kind: 'cod',
    icon: '💰',
    title: 'COD collection',
    hint: 'The cash ledger: every collection, deposit and shortfall, per driver.',
  },
  {
    kind: 'products',
    icon: '📦',
    title: 'Inventory snapshot',
    hint: 'Current stock, reserved and available quantities across all stores.',
  },
  {
    kind: 'drivers',
    icon: '🛵',
    title: 'Driver summary',
    hint: 'Outstanding cash against limit, deliveries completed, last seen.',
  },
] as const;

const RANGES = [7, 30, 90];

export default function Reports() {
  const [rangeDays, setRangeDays] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: string) => {
    setBusy(kind);
    setError(null);
    try {
      await downloadCsv(`/admin/reports/${kind}?rangeDays=${rangeDays}`, `${kind}.csv`);
    } catch {
      setError('Export failed — check the API is running and try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-ink3 dark:text-ink3-dark">
          CSV downloads, ready to open in Excel or Google Sheets
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-ink2 dark:text-ink2-dark">Period</span>
        <div className="flex rounded-full border border-line bg-surface p-1 dark:border-line-dark dark:bg-surface-dark">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRangeDays(r)}
              aria-pressed={rangeDays === r}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                rangeDays === r
                  ? 'bg-moss text-white dark:bg-moss-dark dark:text-[#06120D]'
                  : 'text-ink2 dark:text-ink2-dark'
              }`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-m border border-critical bg-critical-soft px-4 py-3 text-sm text-critical dark:bg-critical-soft-dark dark:text-critical-dark">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.kind} className="flex items-start gap-4">
            <span className="text-2xl">{r.icon}</span>
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <h2 className="font-semibold">{r.title}</h2>
                <p className="mt-0.5 text-sm text-ink2 dark:text-ink2-dark">{r.hint}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => void run(r.kind)}
                disabled={busy !== null}
                className="self-start"
              >
                {busy === r.kind ? 'Preparing…' : `↓ Download CSV`}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink3 dark:text-ink3-dark">
        Files include a UTF-8 byte-order mark so ₹ and Indian names open correctly in Excel.
      </p>
    </div>
  );
}
