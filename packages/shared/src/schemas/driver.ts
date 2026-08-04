import { z } from 'zod';

export const driverStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OFFLINE']),
});

export const driverLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const pickupSchema = z.object({
  otp: z.string().regex(/^\d{4}$/, 'Enter the 4-digit pickup code'),
});

/** COD reality: what was actually collected is RECORDED, never assumed. */
export const deliverSchema = z.object({
  otp: z.string().regex(/^\d{4}$/, 'Enter the 4-digit delivery code'),
  collectedPaise: z.number().int().min(0),
});

export type DriverStatusInput = z.infer<typeof driverStatusSchema>;
export type PickupInput = z.infer<typeof pickupSchema>;
export type DeliverInput = z.infer<typeof deliverSchema>;
