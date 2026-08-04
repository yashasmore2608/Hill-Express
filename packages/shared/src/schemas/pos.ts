import { z } from 'zod';
import { UNITS } from '../constants';

/** FR-P-001 open/close toggle + FR-P-003 default packing time. */
export const patchStoreSchema = z.object({
  isOpen: z.boolean().optional(),
  defaultPrepMin: z.number().int().min(5).max(120).optional(),
});

/** FR-P-005: the fields an operator may edit in place. */
export const patchProductSchema = z.object({
  pricePaise: z.number().int().min(100).max(10_000_000).optional(), // ₹1 – ₹1,00,000
  mrpPaise: z.number().int().min(100).max(10_000_000).nullable().optional(),
  isAvailable: z.boolean().optional(),
  lowStockAt: z.number().int().min(0).max(1000).optional(),
});

/** FR-P-007: stock moves are LEDGER ENTRIES, never direct writes. */
export const stockAdjustSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta cannot be zero')
    .refine((v) => Math.abs(v) <= 10_000, 'Delta too large'),
  note: z.string().max(200).optional(),
});

/**
 * FR-P-006 bulk import. CSV travels as text in JSON — no multipart, works
 * identically from the POS file picker and any script. 2 MB ≈ 20k rows,
 * far beyond a kirana catalogue. (Presigned R2 upload replaces this when
 * the media pipeline lands.)
 */
export const importRequestSchema = z.object({
  fileName: z.string().min(1).max(120),
  content: z.string().min(1).max(2_000_000),
});

/** One CSV row after header mapping. Prices in RUPEES here (human-authored file). */
export const importRowSchema = z.object({
  sku: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  unit: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(UNITS)),
  packSize: z.string().trim().min(1).max(40),
  price: z.coerce.number().positive().max(100_000),
  mrp: z
    .union([z.coerce.number().positive().max(100_000), z.literal('').transform(() => null)])
    .nullable()
    .optional(),
  stock: z.coerce.number().int().min(0).max(100_000),
  lowStockAt: z.coerce.number().int().min(0).max(1000).optional(),
});

/** FR-P-003: per-order packing-time override at accept time. */
export const acceptOrderSchema = z.object({
  prepMinutes: z.number().int().min(5).max(120).optional(),
});

export const rejectOrderSchema = z.object({
  reason: z.string().min(1).max(300),
});

export type AcceptOrderInput = z.infer<typeof acceptOrderSchema>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;

export type PatchStoreInput = z.infer<typeof patchStoreSchema>;
export type PatchProductInput = z.infer<typeof patchProductSchema>;
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
export type ImportRequestInput = z.infer<typeof importRequestSchema>;
export type ImportRow = z.infer<typeof importRowSchema>;

/** The header the CSV must carry (order-insensitive, case-insensitive). */
export const IMPORT_HEADERS = [
  'sku',
  'name',
  'category',
  'unit',
  'packSize',
  'price',
  'mrp',
  'stock',
  'lowStockAt',
] as const;
