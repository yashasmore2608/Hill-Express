import type { BillDto } from '../dto';
import { roundQty } from './quantity';

interface BillableItem {
  pricePaise: number;
  /** DECIMAL(12,3) — may be fractional for loose goods. */
  qty: number;
}

interface BillableStore {
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
}

/**
 * Line total for one item. Price is per UNIT (per kg, per piece), so a
 * fractional quantity produces a fractional paise value — rounded to whole
 * paise once, HERE, so the same number is produced on the phone and on the
 * server. Rounding later or twice is how a bill and its total disagree.
 */
export const lineTotalPaise = (pricePaise: number, qty: number): number =>
  Math.round(pricePaise * roundQty(qty));

/**
 * ONE bill computation, run in two places: the API (authoritative, at cart
 * read and order placement) and the app (instantly, on every stepper tap).
 * Because it is the same function, the numbers can never disagree.
 */
export const computeBill = (items: BillableItem[], store: BillableStore): BillDto => {
  const itemTotalPaise = items.reduce(
    (sum, i) => sum + lineTotalPaise(i.pricePaise, i.qty),
    0,
  );

  const threshold = store.freeDeliveryAbovePaise;
  const qualifiesFree = threshold !== null && itemTotalPaise >= threshold;
  const deliveryFeePaise = itemTotalPaise === 0 || qualifiesFree ? 0 : store.deliveryFeePaise;

  return {
    itemTotalPaise,
    deliveryFeePaise,
    totalPaise: itemTotalPaise + deliveryFeePaise,
    freeDeliveryRemainingPaise:
      threshold === null ? null : Math.max(0, threshold - itemTotalPaise),
  };
};

/** Per-order quantity cap for a single line item. */
export const MAX_QTY_PER_ITEM = 50;
