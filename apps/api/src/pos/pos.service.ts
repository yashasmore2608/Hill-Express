import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  decodeCursor,
  encodeCursor,
  type PatchProductInput,
  type PatchStoreInput,
  type PosSummaryDto,
  type CreateProductInput,
  type ProductPageDto,
  type StockAdjustInput,
} from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toProductDto } from '../catalog/product.mapper';

/** Prisma DECIMAL -> plain number. Quantities only; money stays integer paise. */
const qty = (d: Prisma.Decimal | number): number => Number(d);

/** Every SKU already used under a prefix, for picking the next free one. */
const db_skusFor = async (
  db: PrismaService['db'],
  storeId: string,
  prefix: string,
): Promise<Set<string>> => {
  const rows = await db.product.findMany({
    where: { storeId, sku: { startsWith: `${prefix}-` } },
    select: { sku: true },
  });
  return new Set(rows.map((r) => r.sku).filter((v): v is string => !!v));
};

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
      const avail = Math.max(0, qty(p.stockQty) - qty(p.reservedQty));
      return avail > 0 && avail <= qty(p.lowStockAt);
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
        const avail = Math.max(0, qty(p.stockQty) - qty(p.reservedQty));
        return avail > 0 && avail <= qty(p.lowStockAt);
      });
    }
    const last = rows.slice(0, q.limit).at(-1);
    return {
      items: page.map(toProductDto),
      nextCursor: rows.length > q.limit && last ? encodeCursor({ n: last.name, i: last.id }) : null,
    };
  }

  async patchProduct(
    storeId: string,
    productId: string,
    input: PatchProductInput,
    actorId: string,
  ) {
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

    // A recount states the shelf total; a movement states the change. Only the
    // server can turn the first into the second, because `stockQty` never
    // leaves it — the POS sees availableQty (stock − reserved) instead.
    const current = qty(product.stockQty);
    const delta = input.setTo !== undefined ? input.setTo - current : input.delta!;

    // A count that matches the books is a real and common outcome. It is not
    // an error, and it must not write an empty ledger entry.
    if (delta === 0) return toProductDto(product);

    const next = current + delta;
    if (next < 0) {
      throw new BadRequestException(`Only ${current} in stock — cannot remove ${-delta}`);
    }
    if (next < qty(product.reservedQty)) {
      throw new BadRequestException(
        `${qty(product.reservedQty)} are reserved by live carts — stock cannot drop below that`,
      );
    }

    const [updated] = await db.$transaction([
      db.product.update({ where: { id: productId }, data: { stockQty: next } }),
      db.stockLedger.create({
        data: {
          productId,
          storeId,
          delta,
          // A recount and a movement are different events in an audit — a
          // stocktake that silently reads as "manual +3" hides the count.
          reason: input.setTo !== undefined ? 'ADJUST' : 'MANUAL',
          actorType: 'STORE',
          actorId,
          note: input.note,
        },
      }),
    ]);
    return toProductDto(updated);
  }

  /**
   * Create one product from the counter.
   *
   * Mirrors a single CSV import row on purpose — same find-or-create on
   * category name, same opening-stock ledger entry — so a store that adds a
   * SKU here and a store that re-imports a spreadsheet end up with byte-identical
   * rows. Divergence between the two paths is how catalogues rot.
   */
  /**
   * Next free SKU for a category, in the house style: two letters from the
   * category name, then a zero-padded sequence — AT-001, DA-002, FV-006.
   * Matches what the seed and every hand-authored CSV already use, so an
   * auto-named product and an imported one are indistinguishable later.
   */
  private async nextSku(storeId: string, category: string): Promise<string> {
    const letters = (category.match(/[a-z]/gi) ?? []).slice(0, 2).join('').toUpperCase();
    const prefix = letters.padEnd(2, 'X');
    const taken = await db_skusFor(this.prisma.db, storeId, prefix);
    let n = taken.size + 1;
    // Gaps and manual SKUs mean count+1 can already exist; walk up to the first
    // genuinely free number rather than trusting the count.
    while (taken.has(`${prefix}-${String(n).padStart(3, '0')}`)) n += 1;
    return `${prefix}-${String(n).padStart(3, '0')}`;
  }

  async createProduct(storeId: string, input: CreateProductInput, actorId: string) {
    const db = this.prisma.db;

    const sku = input.sku ?? (await this.nextSku(storeId, input.category));

    // (storeId, sku) is unique and is the re-import match key, so a duplicate
    // is a conflict to report, never a silent update — the operator thinks
    // they are adding something new.
    const clash = await db.product.findUnique({
      where: { storeId_sku: { storeId, sku } },
    });
    if (clash) {
      throw new ConflictException(`SKU ${sku} already exists — it is "${clash.name}"`);
    }

    const existingCategory = await db.category.findFirst({
      where: { storeId, name: { equals: input.category, mode: 'insensitive' }, deletedAt: null },
    });
    const categoryId =
      existingCategory?.id ??
      (
        await db.category.create({
          data: {
            storeId,
            name: input.category,
            sortOrder: await db.category.count({ where: { storeId } }),
          },
        })
      ).id;

    const created = await db.product.create({
      data: {
        storeId,
        sku,
        name: input.name,
        categoryId,
        unit: input.unit,
        packSize: input.packSize,
        pricePaise: input.pricePaise,
        mrpPaise: input.mrpPaise ?? null,
        stockQty: input.stock,
        ...(input.lowStockAt !== undefined ? { lowStockAt: input.lowStockAt } : {}),
      },
    });

    // Opening stock is a movement like any other. Balances are SUMs of this
    // ledger, so a product born with 40 on the shelf and no entry would never
    // reconcile.
    if (input.stock > 0) {
      await db.stockLedger.create({
        data: {
          productId: created.id,
          storeId,
          delta: input.stock,
          reason: 'MANUAL',
          actorType: 'STORE',
          actorId,
          note: 'Opening stock',
        },
      });
    }

    return toProductDto(created);
  }
}
