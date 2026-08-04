import { ulid } from 'ulid';

/**
 * All primary keys are ULIDs: time-sortable, non-guessable, safe to generate
 * app-side (no DB round-trip, works offline-first on mobile).
 */
export const newId = (): string => ulid();

/**
 * Human-readable order number for support calls: HE-260730-0042.
 * The database's per-day sequence supplies `seq`; this only formats it.
 */
export const formatOrderNumber = (date: Date, seq: number): string => {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `HE-${yy}${mm}${dd}-${String(seq).padStart(4, '0')}`;
};
