import { z } from 'zod';
import { idSchema } from './common';

export const productsQuerySchema = z.object({
  categoryId: idSchema.optional(),
  search: z.string().trim().min(1).max(80).optional(),
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ProductsQueryInput = z.infer<typeof productsQuerySchema>;
