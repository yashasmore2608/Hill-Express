import type { Prisma, Product } from '@prisma/client';
import { MAX_QTY_PER_ITEM, type ProductDto } from '@hillexpress/shared';

/** Prisma returns DECIMAL as its own Decimal type; the DTO is plain JSON.
 *  Quantities are ≤6 significant digits so Number is exact here. */
const num = (d: Prisma.Decimal | number): number => Number(d);

export const toProductDto = (p: Product): ProductDto => {
  const availableQty = Math.max(0, num(p.stockQty) - num(p.reservedQty));
  return {
    id: p.id,
    storeId: p.storeId,
    categoryId: p.categoryId,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    packSize: p.packSize,
    pricePaise: p.pricePaise,
    mrpPaise: p.mrpPaise,
    availableQty,
    maxQty: Math.min(availableQty, MAX_QTY_PER_ITEM),
    stepQty: num(p.stepQty),
    minQty: num(p.minQty),
    lowStock: availableQty > 0 && availableQty <= num(p.lowStockAt),
    isAvailable: p.isAvailable && availableQty > 0,
    imageUrl: p.imageUrl,
    blurhash: p.blurhash,
  };
};
