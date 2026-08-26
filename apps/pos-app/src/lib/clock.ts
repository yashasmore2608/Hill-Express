import type { PosOrderDto } from '@hillexpress/shared';

/**
 * Order timing, reduced to the two things a card shows: how long it has been
 * waiting, and whether it is late.
 *
 * An earlier version modelled slack against a computed counter-deadline and
 * re-sorted the queue by it. That was more accurate and less familiar — every
 * partner app an Indian store operator has used shows a plain elapsed timer and
 * a late badge, in arrival order. Accuracy nobody recognises is not worth the
 * training cost, so this keeps the honest threshold and drops the arithmetic.
 */

/** The customer-facing promise, placement to doorstep. */
export const PROMISE_MIN = 30;

/**
 * How much of the promise belongs to the road. The store's own deadline is
 * earlier than the customer's: a bag packed at minute 29 is already late.
 */
export const TRAVEL_RESERVE_MIN = 12;

/** Past this many minutes at the counter, the order is flagged late. */
export const LATE_AFTER_MIN = PROMISE_MIN - TRAVEL_RESERVE_MIN;

const MINUTE = 60_000;

/** Whole minutes since the customer placed the order. */
export const elapsedMin = (order: PosOrderDto, now: number = Date.now()): number =>
  Math.max(0, Math.floor((now - new Date(order.placedAt).getTime()) / MINUTE));

/**
 * States the store can no longer influence — either the bag has left, or the
 * order is over. Rejected and cancelled belong here as much as delivered does:
 * an order nobody is waiting for cannot be late, and badging one in history as
 * LATE invents a failure that never happened.
 */
const CLOSED_TO_STORE = new Set([
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
]);

/**
 * Late only while the store can still do something about it. Flagging an order
 * the driver already collected is noise the operator cannot act on.
 */
export const isLate = (order: PosOrderDto, now: number = Date.now()): boolean =>
  !CLOSED_TO_STORE.has(order.fulfillmentStatus) && elapsedMin(order, now) > LATE_AFTER_MIN;
