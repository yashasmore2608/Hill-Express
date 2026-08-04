import { z } from 'zod';

/** E.164 Indian mobile: +91 followed by 10 digits starting 6-9. */
export const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const pincodeSchema = z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code');

export const idSchema = z.string().min(10).max(40);

export const paiseSchema = z.number().int().nonnegative();

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Cursor pagination — OFFSET is banned repo-wide. */
export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
