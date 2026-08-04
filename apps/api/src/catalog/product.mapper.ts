import type { Product } from '@prisma/client';
import { MAX_QTY_PER_ITEM, type ProductDto } from '@hillexpress/shared';

export const toProductDto = (p: Product): ProductDto => {
  const availableQty = Math.max(0, p.stockQty - p.reservedQty);
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
    lowStock: availableQty > 0 && availableQty <= p.lowStockAt,
    isAvailable: p.isAvailable && availableQty > 0,
    imageUrl: p.imageUrl,
    blurhash: p.blurhash,
  };
};
