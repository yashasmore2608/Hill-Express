/** Business constants — SRS-derived. Anything ops should tune lives in the DB instead. */

export const LIMITS = {
  /** FR-C-003: max saved addresses per customer. */
  maxAddresses: 2,
  /** COD risk controls (defaults; per-user overrides live on the user row). */
  maxOpenCodOrders: 1,
  firstTimerCodCapPaise: 50_000, // ₹500
  codAutoFlagAfterFailed: 2,
  codBlockAfterFailed: 3,
  /** OTP */
  otpLength: 4,
  otpMaxAttempts: 3,
  otpExpiryMinutes: 10,
  /** Cart reservation released by cron after this. */
  stockReservationMinutes: 30,
} as const;

export const UNITS = ['KG', 'G', 'LITRE', 'ML', 'PIECE', 'PACK'] as const;
export type Unit = (typeof UNITS)[number];

export const PAYMENT_METHODS = ['COD', 'UPI', 'CARD', 'NETBANKING', 'WALLET'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/** v1 ships COD-only; the rest exist so adding a gateway later is additive. */
export const ENABLED_PAYMENT_METHODS: readonly PaymentMethod[] = ['COD'];

export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
