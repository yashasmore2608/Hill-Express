import { z } from 'zod';
import { phoneSchema } from './common';

/** Which surface is signing in — decides which table the phone must match. */
export const audienceSchema = z.enum(['CUSTOMER', 'DRIVER', 'POS']);
export type Audience = z.infer<typeof audienceSchema>;

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  audience: audienceSchema.default('CUSTOMER'),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^\d{4}$/, 'Enter the 4-digit code'),
  audience: audienceSchema.default('CUSTOMER'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
