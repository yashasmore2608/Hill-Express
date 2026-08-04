/** Indian digit grouping (2,2,3) everywhere — ₹1,24,500 not ₹124,500. */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat('en-IN');

export const rupees = (paise: number) => inr.format(paise / 100);
/** Axis ticks and tight tiles: ₹1.2L instead of ₹1,24,500. */
export const rupeesShort = (paise: number) => inrCompact.format(paise / 100);
export const count = (n: number) => num.format(n);

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export const minutesAgo = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

/** Order status → the four reserved status roles. Never a categorical hue. */
export const statusTone = (
  s: string,
): 'good' | 'warning' | 'serious' | 'critical' | 'neutral' => {
  if (s === 'DELIVERED') return 'good';
  if (s === 'PLACED') return 'warning';
  if (s === 'REJECTED') return 'critical';
  if (s === 'CANCELLED') return 'neutral';
  if (s === 'OUT_FOR_DELIVERY' || s === 'PICKED_UP') return 'serious';
  return 'good';
};

export const statusLabel = (s: string) =>
  s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
