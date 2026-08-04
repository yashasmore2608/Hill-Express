import { z } from 'zod';
import { latLngSchema, pincodeSchema } from './common';

export const saveAddressSchema = z
  .object({
    label: z.string().min(1).max(30),
    house: z.string().min(1).max(120),
    street: z.string().min(1).max(120),
    landmark: z.string().max(120).optional(),
    city: z.string().min(1).max(60),
    pincode: pincodeSchema,
    instructions: z.string().max(300).optional(),
  })
  .merge(latLngSchema);

export type SaveAddressInput = z.infer<typeof saveAddressSchema>;
