import { z } from 'zod';
import { idSchema } from './common';

/** Admin signs in with email + password — internal staff, not OTP. */
export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

/** Dispatch (FR-A-003) — admin-only per SRS §1.3. */
export const assignDriverSchema = z.object({
  driverId: idSchema,
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
