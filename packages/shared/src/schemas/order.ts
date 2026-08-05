import { z } from 'zod';
import { idSchema } from './common';

/**
 * Order placement. `idempotencyKey` is generated client-side per checkout
 * attempt — flaky hill networks retry, and a double-placed order is the #1
 * field bug in delivery apps.
 */
export const placeOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  storeId: idSchema,
  addressId: idSchema,
  paymentMethod: z.literal('COD'), // v1: COD only — widen this union when a gateway lands
  items: z
    .array(
      z.object({
        productId: idSchema,
        /** DECIMAL(12,3) — 0.5 kg of tomatoes is a valid order line. */
        qty: z.number().positive().max(50).multipleOf(0.001),
      }),
    )
    .min(1)
    .max(100),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(300),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
