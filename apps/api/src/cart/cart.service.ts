import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeBill,
  MAX_QTY_PER_ITEM,
  type CartDto,
  type SetCartItemInput,
} from '@hillexpress/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toProductDto } from '../catalog/product.mapper';

/** Prisma DECIMAL -> plain number. Quantities only; money stays integer paise. */
const qty = (d: Prisma.Decimal | number): number => Number(d);

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Set-quantity semantics (qty 0 removes). Idempotent: a retried "set to 3"
   * is still 3 — flaky hill networks retry, and additive APIs double-add.
   * The server clamps to live availability; the response is the truth the
   * optimistic client reconciles against.
   */
  async setItem(userId: string, input: SetCartItemInput): Promise<CartDto> {
    const db = this.prisma.db;

    const product = await db.product.findFirst({
      where: { id: input.productId, storeId: input.storeId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found in this store');

    const store = await db.store.findFirst({
      where: { id: input.storeId, isBlocked: false },
    });
    if (!store) throw new BadRequestException('Store unavailable');

    const cart = await db.cart.upsert({
      where: { userId_storeId: { userId, storeId: input.storeId } },
      update: {},
      create: { userId, storeId: input.storeId },
    });

    const availableQty = Math.max(0, qty(product.stockQty) - qty(product.reservedQty));
    const clamped = Math.min(input.qty, availableQty, MAX_QTY_PER_ITEM);

    if (clamped === 0) {
      await db.cartItem.deleteMany({ where: { cartId: cart.id, productId: product.id } });
    } else {
      await db.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: product.id } },
        update: { qty: clamped },
        create: { cartId: cart.id, productId: product.id, qty: clamped },
      });
    }

    return this.get(userId, input.storeId);
  }

  async get(userId: string, storeId: string): Promise<CartDto> {
    const db = this.prisma.db;

    const store = await db.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const cart = await db.cart.findUnique({
      where: { userId_storeId: { userId, storeId } },
      include: { items: { include: { product: true } } },
    });

    const items = (cart?.items ?? [])
      .filter((i) => i.product.deletedAt === null)
      .map((i) => ({
        productId: i.productId,
        // Availability can drop between adds — reflect reality, don't error.
        qty: Math.min(qty(i.qty), Math.max(0, qty(i.product.stockQty) - qty(i.product.reservedQty))),
        product: toProductDto(i.product),
      }))
      .filter((i) => i.qty > 0);

    return {
      storeId,
      items,
      bill: computeBill(
        items.map((i) => ({ pricePaise: i.product.pricePaise, qty: i.qty })),
        store,
      ),
    };
  }
}
