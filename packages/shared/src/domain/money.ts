/**
 * Money is ALWAYS integer paise. Never floats, never rupees-as-number.
 * In a COD-only business a rounding bug is a cash shortfall.
 *
 * The branded type makes TypeScript reject `finalPaise = 249.5` and stops
 * accidental mixing of rupee and paise values at compile time.
 */

declare const paiseBrand: unique symbol;
export type Paise = number & { readonly [paiseBrand]: true };

export const paise = (value: number): Paise => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Money must be integer paise, got: ${value}`);
  }
  return value as Paise;
};

export const rupeesToPaise = (rupees: number): Paise => paise(Math.round(rupees * 100));

export const addPaise = (...values: Paise[]): Paise =>
  paise(values.reduce((sum, v) => sum + v, 0));

/**
 * Format paise for display with INDIAN digit grouping (2,2,3):
 *   formatINR(paise(12450000)) === '₹1,24,500'
 * Fractional paise are shown only when present: ₹249.50, never ₹249.00.
 * This is the ONLY sanctioned way to render money in any surface.
 */
export const formatINR = (value: Paise, opts?: { showFraction?: boolean }): string => {
  const rupees = value / 100;
  const hasFraction = value % 100 !== 0;
  const showFraction = opts?.showFraction ?? hasFraction;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showFraction ? 2 : 0,
    maximumFractionDigits: showFraction ? 2 : 0,
  }).format(rupees);
};
