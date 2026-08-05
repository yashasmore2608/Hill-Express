import { z } from 'zod';
import { idSchema } from './common';
import { MAX_QTY_PER_ITEM } from '../domain/bill';

/** Set-quantity semantics: qty 0 removes the line. Idempotent by nature —
 *  a retried "set to 3" is still 3, never 6. Flaky networks retry. */
export const setCartItemSchema = z.object({
  storeId: idSchema,
  productId: idSchema,
  /** DECIMAL(12,3): loose goods sell in halves and quarters, so this is
   *  deliberately not an integer. 0 removes the line. */
  qty: z.number().min(0).max(MAX_QTY_PER_ITEM).multipleOf(0.001),
});

export type SetCartItemInput = z.infer<typeof setCartItemSchema>;
