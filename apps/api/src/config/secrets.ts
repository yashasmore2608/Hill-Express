import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * One home for signing material. Dev fallback: random per-boot secrets so
 * auth works out of the box (tokens die on restart — fine for dev).
 * Production MUST set real env secrets.
 */
export const accessSecret = env.JWT_ACCESS_SECRET || randomBytes(32).toString('hex');
export const refreshSecret = env.JWT_REFRESH_SECRET || randomBytes(32).toString('hex');

/**
 * Order OTPs are DERIVED, not stored: HMAC(orderId:purpose) → 4 digits.
 * The right party can always be shown their code (customer sees delivery
 * OTP, store reads pickup OTP to the driver), verification recomputes it,
 * and nothing secret ever sits in a table.
 */
export const otpFor = (orderId: string, purpose: 'PICKUP' | 'DELIVERY'): string => {
  const digest = createHmac('sha256', accessSecret).update(`${orderId}:${purpose}`).digest();
  return String((digest.readUInt32BE(0) % 9000) + 1000);
};

/**
 * Short-lived signed link for one invoice PDF.
 *
 * A mobile app cannot put an Authorization header on a URL it hands to the
 * OS browser or a share sheet, and the alternative — pulling in native
 * file-system and sharing modules purely to attach one header — is a lot of
 * moving parts for a download button. So the link carries its own proof:
 * HMAC over (invoiceId, expiry), valid for 15 minutes.
 *
 * The signature covers the expiry, so a link cannot be extended by editing
 * the query string, and comparison is constant-time.
 */
export const INVOICE_LINK_TTL_MS = 15 * 60_000;

export const signInvoiceLink = (invoiceId: string, expiresAt: number): string =>
  createHmac('sha256', accessSecret)
    .update(`invoice:${invoiceId}:${expiresAt}`)
    .digest('base64url');

export const verifyInvoiceLink = (
  invoiceId: string,
  expiresAt: number,
  signature: string,
): boolean => {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = Buffer.from(signInvoiceLink(invoiceId, expiresAt));
  const given = Buffer.from(signature);
  // timingSafeEqual throws on length mismatch — check first, and note that
  // leaking the LENGTH of a base64url HMAC tells an attacker nothing.
  return expected.length === given.length && timingSafeEqual(expected, given);
};

// ── Password hashing (admin accounts) — scrypt, no external deps ──

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
};
