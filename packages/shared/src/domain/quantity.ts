import type { Unit } from '../constants';

/**
 * Quantity is DECIMAL(12,3) in the database (spec 2.2) because groceries sell
 * by weight — 0.5 kg of tomatoes must be representable.
 *
 * Across the API boundary it travels as a plain `number`, which is safe here
 * and NOT the same call as money: quantities carry 3 decimal places and stay
 * under ~100,000, so every value is exactly representable in a float. Money
 * stays integer paise precisely because totals accumulate and cents don't
 * survive that.
 */
export const QTY_DP = 3;

/** Round to the stored precision so float drift never reaches the database. */
export const roundQty = (q: number): number =>
  Math.round(q * 10 ** QTY_DP) / 10 ** QTY_DP;

/** Units sold loose, where a fractional quantity is normal. */
const LOOSE_UNITS: readonly Unit[] = ['KG', 'LITRE'];

export const isLooseUnit = (unit: string): boolean =>
  LOOSE_UNITS.includes(unit as Unit);

/**
 * Display a quantity the way a shopper would say it:
 *   1     KG    -> "1 kg"
 *   0.5   KG    -> "500 g"      (sub-kilo reads better in grams)
 *   1.5   KG    -> "1.5 kg"
 *   2     PIECE -> "2"
 */
export const formatQty = (qty: number, unit: string): string => {
  const q = roundQty(qty);

  if (unit === 'KG' && q < 1) return `${Math.round(q * 1000)} g`;
  if (unit === 'LITRE' && q < 1) return `${Math.round(q * 1000)} ml`;

  const n = Number.isInteger(q) ? String(q) : String(q);
  switch (unit) {
    case 'KG':
      return `${n} kg`;
    case 'LITRE':
      return `${n} L`;
    case 'G':
      return `${n} g`;
    case 'ML':
      return `${n} ml`;
    case 'PACK':
      return `${n} pack${q === 1 ? '' : 's'}`;
    default:
      return n;
  }
};

/** Next quantity up, honouring the product's own step. */
export const stepUp = (qty: number, step: number, max: number): number =>
  roundQty(Math.min(max, qty + step));

/**
 * Next quantity down. Dropping below the minimum means "remove", so it
 * returns 0 rather than clamping — otherwise the last decrement does nothing.
 */
export const stepDown = (qty: number, step: number, min: number): number => {
  const next = roundQty(qty - step);
  return next < min ? 0 : next;
};
