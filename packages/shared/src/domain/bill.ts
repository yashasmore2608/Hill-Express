import type { BillDto } from '../dto';

interface BillableItem {
  pricePaise: number;
  qty: number;
}

interface BillableStore {
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
}

/**
 * ONE bill computation, run in two places: the API (authoritative, at cart
 * read and order placement) and the app (instantly, on every stepper tap).
 * Because it is the same function, the numbers can never disagree.
 */
export const computeBill = (items: BillableItem[], store: BillableStore): BillDto => {
  const itemTotalPaise = items.reduce((sum, i) => sum + i.pricePaise * i.qty, 0);

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
