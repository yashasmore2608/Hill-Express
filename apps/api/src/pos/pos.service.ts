import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  decodeCursor,
  encodeCursor,
  type PatchProductInput,
  type PatchStoreInput,
  type PosSummaryDto,
  type ProductPageDto,
  type StockAdjustInput,
} from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toProductDto } from '../catalog/product.mapper';

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(storeId: string): Promise<PosSummaryDto> {
    const db = this.prisma.db;
    const store = await db.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const live: Prisma.ProductWhereInput = { storeId, deletedAt: null };
    const [productCount, outOfStockCount, lowRows, activeOrders] = await Promise.all([
      db.product.count({ where: live }),
      db.product.count({ where: { ...live, stockQty: { equals: 0 } } }),
      // low = 0 < available ≤ threshold; needs the row's own threshold, so fetch slim
      db.product.findMany({
        where: { ...live, stockQty: { gt: 0 } },
        select: { stockQty: true, reservedQty: true, lowStockAt: true },
      }),
      db.order.count({
        where: {
          storeId,
          fulfillmentStatus: { in: ['PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP'] },
        },
      }),
    ]);
    const lowStockCount = lowRows.filter((p) => {
      const avail = Math.max(0, p.stockQty - p.reservedQty);
      return avail > 0 && avail <= p.lowStockAt;
    }).length;

    return {
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
        isOpen: store.isOpen,
        isBlocked: store.isBlocked,
        defaultPrepMin: store.defaultPrepMin,
        openTime: store.openTime,
        closeTime: store.closeTime,
      },
      productCount,
      lowStockCount,
      outOfStockCount,
      activeOrders,
    };
  }

  async patchStore(storeId: string, input: PatchStoreInput, actorId: string) {
    const db = this.prisma.db;
    const store = await db.store.update({ where: { id: storeId }, data: input });
    await db.auditLog.create({
      data: {
        actorType: 'STORE',
        actorId,
        action: 'store.update',
        entity: 'Store',
        entityId: storeId,
        payload: input as Prisma.InputJsonValue,
      },
    });
    return { isOpen: store.isOpen, defaultPrepMin: store.defaultPrepMin };
  }

  /** Operator's product list — includes out-of-stock and hidden items. */
  async products(
    storeId: string,
    q: { cursor?: string; limit: number; search?: string; filter?: 'low' | 'out' },
  ): Promise<ProductPageDto> {
    const db = this.prisma.db;

    const base: Prisma.ProductWhereInput = {
      storeId,
      deletedAt: null,
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
      ...(q.filter === 'out' ? { stockQty: { equals: 0 } } : {}),
    };

    const cur = q.cursor ? decodeCursor(q.cursor) : null;
    const where: Prisma.ProductWhereInput = cur
      ? { AND: [base, { OR: [{ name: { gt: cur.n } }, { name: cur.n, id: { gt: cur.i } }] }] }
      : base;

    // 'low' needs per-row thresholds — filter after fetch, page size still honored upstream.
    const rows = await db.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: q.limit + 1,
    });

    let page = rows.slice(0, q.limit);
    if (q.filter === 'low') {
      page = page.filter((p) => {
        const avail = Math.max(0, p.stockQty - p.reservedQty);
        return avail > 0 && avail <= p.lowStockAt;
      });
    }
    const last = rows.slice(0, q.limit).at(-1);
    return {
      items: page.map(toProductDto),
      nextCursor: rows.length > q.limit && last ? encodeCursor({ n: last.name, i: last.id }) : null,
    };
  }

  async patchProduct(storeId: string, productId: string, input: PatchProductInput, actorId: string) {
    const db = this.prisma.db;
    const product = await db.product.findFirst({
      where: { id: productId, storeId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const updated = await db.product.update({ where: { id: productId }, data: input });
    await db.auditLog.create({
      data: {
        actorType: 'STORE',
        actorId,
        action: 'product.update',
        entity: 'Product',
        entityId: productId,
        payload: input as Prisma.InputJsonValue,
      },
    });
    return toProductDto(updated);
  }

  /**
   * FR-P-007. Stock NEVER moves without a ledger row — the two writes share
   * one transaction, so current stock is always provable as SUM(ledger).
   */
  async adjustStock(storeId: string, productId: string, input: StockAdjustInput, actorId: string) {
    const db = this.prisma.db;
    const product = await db.product.findFirst({
      where: { id: productId, storeId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const next = product.stockQty + input.delta;
    if (next < 0) {
      throw new BadRequestException(`Only ${product.stockQty} in stock — cannot remove ${-input.delta}`);
    }
    if (next < product.reservedQty) {
      throw new BadRequestException(
        `${product.reservedQty} are reserved by live carts — stock cannot drop below that`,
      );
    }

    const [updated] = await db.$transaction([
      db.product.update({ where: { id: productId }, data: { stockQty: next } }),
      db.stockLedger.create({
        data: {
          productId,
          storeId,
          delta: input.delta,
          reason: 'MANUAL',
          actorType: 'STORE',
          actorId,
          note: input.note,
        },
      }),
    ]);
    return toProductDto(updated);
  }
}
