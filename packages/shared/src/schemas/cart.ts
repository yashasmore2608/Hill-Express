import { z } from 'zod';
import { idSchema } from './common';
import { MAX_QTY_PER_ITEM } from '../domain/bill';

/** Set-quantity semantics: qty 0 removes the line. Idempotent by nature —
 *  a retried "set to 3" is still 3, never 6. Flaky networks retry. */
export const setCartItemSchema = z.object({
  storeId: idSchema,
  productId: idSchema,
  qty: z.number().int().min(0).max(MAX_QTY_PER_ITEM),
});

export type SetCartItemInput = z.infer<typeof setCartItemSchema>;
