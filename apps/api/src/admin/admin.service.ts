import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ACTIVE_FULFILLMENT_STATUSES } from '@hillexpress/shared';
import type { AdminDispatchOrderDto, AdminDriverDto } from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

/** Prisma DECIMAL -> plain number. Quantities only; money stays integer paise. */
const qty = (d: Prisma.Decimal | number): number => Number(d);

const FULFILLMENT_STATUSES = [
  'PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED',
] as const;
type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];
const isFulfillmentStatus = (s: string): s is FulfillmentStatus =>
  (FULFILLMENT_STATUSES as readonly string[]).includes(s);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async dispatchBoard(): Promise<AdminDispatchOrderDto[]> {
    const rows = await this.prisma.db.order.findMany({
      where: {
        fulfillmentStatus: {
          in: ['PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'],
        },
      },
      include: {
        items: { select: { qty: true } },
        store: { select: { name: true } },
        address: { select: { street: true, city: true } },
        driver: { select: { name: true } },
      },
      orderBy: { placedAt: 'asc' },
      take: 200,
    });
    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      fulfillmentStatus: o.fulfillmentStatus,
      assignmentStatus: o.assignmentStatus,
      codDuePaise: o.codDuePaise,
      itemCount: o.items.reduce((n, i) => n + qty(i.qty), 0),
      placedAt: o.placedAt.toISOString(),
      storeName: o.store.name,
      addressArea: `${o.address.street}, ${o.address.city}`,
      driverId: o.driverId,
      driverName: o.driver?.name ?? null,
    }));
  }

  /** All orders with filters — the admin Orders table. */
  async ordersList(q: { status?: string; search?: string; cursor?: string }) {
    const db = this.prisma.db;
    const limit = 30;
    const where: Prisma.OrderWhereInput = {
      // Unknown strings would reach Prisma as an enum value and throw a 500;
      // an unrecognised filter should simply mean "no status filter".
      ...(q.status && q.status !== 'ALL' && isFulfillmentStatus(q.status)
        ? { fulfillmentStatus: q.status }
        : {}),
      ...(q.search
        ? {
            OR: [
              { orderNumber: { contains: q.search, mode: 'insensitive' } },
              { user: { phone: { contains: q.search } } },
            ],
          }
        : {}),
      ...(q.cursor ? { placedAt: { lt: new Date(q.cursor) } } : {}),
    };
    const rows = await db.order.findMany({
      where,
      include: {
        items: { select: { qty: true } },
        user: { select: { phone: true, name: true } },
        store: { select: { name: true } },
        driver: { select: { name: true } },
        address: { select: { street: true, city: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        fulfillmentStatus: o.fulfillmentStatus,
        assignmentStatus: o.assignmentStatus,
        codDuePaise: o.codDuePaise,
        finalPaise: o.finalPaise,
        itemCount: o.items.reduce((n, i) => n + qty(i.qty), 0),
        placedAt: o.placedAt.toISOString(),
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
        storeName: o.store.name,
        addressArea: `${o.address.street}, ${o.address.city}`,
        customerPhone: o.user.phone,
        driverId: o.driverId,
        driverName: o.driver?.name ?? null,
      })),
      nextCursor:
        rows.length > limit && page.at(-1) ? page.at(-1)!.placedAt.toISOString() : null,
    };
  }

  /** Inventory across every store — admin has the wide view a POS doesn't. */
  async products(q: { filter?: string; search?: string }) {
    const db = this.prisma.db;
    const rows = await db.product.findMany({
      where: {
        deletedAt: null,
        ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
      },
      include: { category: { select: { name: true } }, store: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: 300,
    });
    const mapped = rows.map((p) => {
      const available = Math.max(0, qty(p.stockQty) - qty(p.reservedQty));
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category.name,
        storeName: p.store.name,
        packSize: p.packSize,
        pricePaise: p.pricePaise,
        mrpPaise: p.mrpPaise,
        stockQty: qty(p.stockQty),
        reservedQty: qty(p.reservedQty),
        availableQty: available,
        lowStockAt: qty(p.lowStockAt),
        lowStock: available > 0 && available <= qty(p.lowStockAt),
        isAvailable: p.isAvailable,
      };
    });
    if (q.filter === 'low') return mapped.filter((p) => p.lowStock);
    if (q.filter === 'out') return mapped.filter((p) => p.availableQty === 0);
    return mapped;
  }

  async drivers(): Promise<AdminDriverDto[]> {
    const db = this.prisma.db;
    const rows = await db.driver.findMany({ orderBy: { name: 'asc' } });
    return Promise.all(
      rows.map(async (d) => {
        const [exposure, activeOrders] = await Promise.all([
          this.orders.driverCodExposure(d.id),
          db.order.count({
            where: {
              driverId: d.id,
              // Canonical list, PLACED included — a driver assigned to an
              // order the store has not accepted yet is still carrying it.
              fulfillmentStatus: { in: [...ACTIVE_FULFILLMENT_STATUSES] },
            },
          }),
        ]);
        return {
          id: d.id,
          name: d.name,
          phone: d.phone,
          status: d.status,
          codOutstandingPaise: exposure,
          codLimitPaise: d.codLimitPaise,
          activeOrders,
          lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        };
      }),
    );
  }
}
