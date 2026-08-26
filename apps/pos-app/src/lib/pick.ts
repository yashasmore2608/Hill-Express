import type { OrderItemLineDto } from '@hillexpress/shared';
import { isLooseUnit, roundQty } from '@hillexpress/shared';

/**
 * How a line reads to the person picking it.
 *
 * `unit` on a product describes what is INSIDE the pack; `qty` means two
 * different things depending on it:
 *
 *   loose (KG, LITRE)  → qty is a measured amount.  1.5 KG  = weigh 1.5 kg
 *   packaged (others)  → qty is a COUNT of packs.   2 ML/500ml = two bottles
 *
 * Collapsing those two into one string is why the current queue renders two
 * 500 ml milk packs as "2 ml". A picker needs the distinction anyway — one
 * instruction sends you to the scale, the other to the shelf — so it is
 * modelled here rather than papered over.
 *
 * (`formatQty` in packages/shared has the same flaw and is used by the customer
 * and driver apps too, so it is deliberately left alone: changing it is a
 * cross-surface decision, not a POS one.)
 */

export type PickMode = 'weigh' | 'count';

export interface PickLine {
  /** 'weigh' → to the scale. 'count' → off the shelf. */
  mode: PickMode;
  /** The big instruction: "1.5 kg" or "2". */
  amount: string;
  /** The qualifier: "" for loose, "× 500 ml" for packaged. */
  qualifier: string;
  /** Screen-reader / long-form rendering of the same thing. */
  spoken: string;
}

const trim = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(roundQty(n)).replace(/\.?0+$/, '');

/** Grams read better than fractional kilos on a scale. */
const measured = (qty: number, unit: string): string => {
  const q = roundQty(qty);
  if (unit === 'KG') return q < 1 ? `${Math.round(q * 1000)} g` : `${trim(q)} kg`;
  if (unit === 'LITRE') return q < 1 ? `${Math.round(q * 1000)} ml` : `${trim(q)} L`;
  return trim(q);
};

/**
 * Is this line actually weighed at the counter?
 *
 * `isLooseUnit` answers from the UNIT alone, and the unit does not carry the
 * answer: in the current catalogue `KG` covers both loose produce (Onion,
 * Tomato — genuinely weighed) and sealed packs (5 kg Aashirvaad Atta, 1 kg Surf
 * Excel — never weighed). packSize does not separate them either; loose onions
 * and bagged basmati both read "1 kg".
 *
 * Sending a picker to the scale for a box of detergent is worse than not
 * grouping at all, so this only says yes when the product explicitly says so.
 * `soldLoose` does not exist on Product yet — adding it turns the weigh
 * grouping on with no further change here.
 */
type MaybeLoose = OrderItemLineDto & { soldLoose?: boolean };

export const isWeighed = (item: OrderItemLineDto): boolean =>
  (item as MaybeLoose).soldLoose === true && isLooseUnit(item.unit);

export const pickLine = (item: OrderItemLineDto): PickLine => {
  if (isWeighed(item)) {
    const amount = measured(item.qty, item.unit);
    return { mode: 'weigh', amount, qualifier: '', spoken: `weigh ${amount}` };
  }

  // Loose units still render as a measured amount ("500 g", "1.5 kg") — that
  // part is right regardless; it is only the trip to the scale that is unsafe
  // to assume.
  if (isLooseUnit(item.unit)) {
    const amount = measured(item.qty, item.unit);
    // packSize repeats the amount for a single full pack ("1 L" of a 1 L
    // bottle) — printing it twice reads as a mistake, so it earns its place
    // only when it says something the amount does not.
    const qualifier = item.packSize && item.packSize !== amount ? item.packSize : '';
    return { mode: 'count', amount, qualifier, spoken: amount };
  }

  const count = trim(item.qty);
  // packSize is already the human label ("500 ml", "4 × 75 g"), so it is shown
  // verbatim rather than rebuilt from unit — the label on the shelf wins.
  // Multipacks carry their own "×", and "× 4 × 75 g" reads as an error.
  const qualifier = !item.packSize
    ? ''
    : item.packSize.includes('×')
      ? item.packSize
      : `× ${item.packSize}`;
  return {
    mode: 'count',
    amount: count,
    qualifier,
    spoken: qualifier ? `${count} ${qualifier}` : count,
  };
};

/**
 * Lines a picker must weigh, first. Walking to the scale once beats walking to
 * it four times, and loose goods are the slowest part of any grocery pick.
 */
export const byPickRoute = (a: OrderItemLineDto, b: OrderItemLineDto): number => {
  const wa = isWeighed(a) ? 0 : 1;
  const wb = isWeighed(b) ? 0 : 1;
  return wa !== wb ? wa - wb : a.name.localeCompare(b.name);
};
