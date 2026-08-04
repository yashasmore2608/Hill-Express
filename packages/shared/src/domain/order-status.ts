/**
 * The order lives on TWO INDEPENDENT AXES (SRS §2.4: admin assigns a driver
 * while the store is still packing — those are concurrent, so they must be
 * separate fields). Merging them into one enum creates ~20 representable-but-
 * unreachable states; this file is why that never happens.
 *
 * Every state change in any surface goes through `canTransition` — no
 * controller ever writes a status field directly.
 */

export const FULFILLMENT_STATUSES = [
  'PLACED',
  'ACCEPTED',
  'PACKING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  'UNASSIGNED',
  'ASSIGNED',
  'ACCEPTED_BY_DRIVER',
  'REASSIGNED',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export type ActorType = 'CUSTOMER' | 'STORE' | 'DRIVER' | 'ADMIN' | 'SYSTEM';

/** Legal fulfillment transitions, and who may perform each. */
const FULFILLMENT_TRANSITIONS: Record<
  FulfillmentStatus,
  Partial<Record<FulfillmentStatus, ActorType[]>>
> = {
  PLACED: {
    ACCEPTED: ['STORE'],
    REJECTED: ['STORE'],
    CANCELLED: ['CUSTOMER', 'ADMIN'],
  },
  ACCEPTED: {
    PACKING: ['STORE'],
    CANCELLED: ['ADMIN'],
  },
  PACKING: {
    READY_FOR_PICKUP: ['STORE'],
    CANCELLED: ['ADMIN'],
  },
  READY_FOR_PICKUP: {
    PICKED_UP: ['DRIVER'],
    CANCELLED: ['ADMIN'],
  },
  PICKED_UP: {
    OUT_FOR_DELIVERY: ['DRIVER', 'SYSTEM'],
  },
  OUT_FOR_DELIVERY: {
    DELIVERED: ['DRIVER'],
  },
  DELIVERED: {},
  REJECTED: {},
  CANCELLED: {},
};

const ASSIGNMENT_TRANSITIONS: Record<
  AssignmentStatus,
  Partial<Record<AssignmentStatus, ActorType[]>>
> = {
  UNASSIGNED: { ASSIGNED: ['ADMIN'] }, // admin-only dispatch, per SRS §1.3
  ASSIGNED: {
    ACCEPTED_BY_DRIVER: ['DRIVER'],
    REASSIGNED: ['ADMIN'],
  },
  ACCEPTED_BY_DRIVER: { REASSIGNED: ['ADMIN'] },
  REASSIGNED: { ASSIGNED: ['ADMIN'] },
};

export const canTransitionFulfillment = (
  from: FulfillmentStatus,
  to: FulfillmentStatus,
  actor: ActorType,
): boolean => FULFILLMENT_TRANSITIONS[from][to]?.includes(actor) ?? false;

export const canTransitionAssignment = (
  from: AssignmentStatus,
  to: AssignmentStatus,
  actor: ActorType,
): boolean => ASSIGNMENT_TRANSITIONS[from][to]?.includes(actor) ?? false;

/** Terminal states — no further fulfillment transitions exist. */
export const isTerminal = (s: FulfillmentStatus): boolean =>
  s === 'DELIVERED' || s === 'REJECTED' || s === 'CANCELLED';

/** States in which a customer may still cancel without admin help. */
export const customerCanCancel = (s: FulfillmentStatus): boolean => s === 'PLACED';

/** Assignment is only meaningful while the order is live. */
export const assignmentRelevant = (s: FulfillmentStatus): boolean => !isTerminal(s);
