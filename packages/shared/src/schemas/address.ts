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

/**
 * Editing an address is a PATCH: "fix the flat number" should not require
 * re-sending the pincode and coordinates. At least one field must be present,
 * so an empty body is a 400 rather than a silent no-op.
 */
export const patchAddressSchema = saveAddressSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export type SaveAddressInput = z.infer<typeof saveAddressSchema>;
export type PatchAddressInput = z.infer<typeof patchAddressSchema>;
