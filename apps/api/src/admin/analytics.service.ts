import { Injectable } from '@nestjs/common';
import type {
  AdminAnalyticsDto,
  HourBucketDto,
  StatusSliceDto,
  TimePointDto,
  TopProductDto,
} from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private pctDelta(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null; // null → "no basis to compare"
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  async overview(rangeDays: number): Promise<AdminAnalyticsDto> {
    const db = this.prisma.db;
    const now = new Date();
    const from = new Date(now.getTime() - rangeDays * DAY_MS);
    const prevFrom = new Date(now.getTime() - 2 * rangeDays * DAY_MS);

    const [orders, prevOrders, products, codAgg, newCustomers] = await Promise.all([
      db.order.findMany({
        where: { placedAt: { gte: from } },
        select: {
          id: true,
          placedAt: true,
          deliveredAt: true,
          finalPaise: true,
          codDuePaise: true,
          fulfillmentStatus: true,
          etaHighMinutes: true,
        },
      }),
      db.order.findMany({
        where: { placedAt: { gte: prevFrom, lt: from } },
        select: { finalPaise: true, fulfillmentStatus: true },
      }),
      db.product.findMany({
        where: { deletedAt: null },
        select: { stockQty: true, reservedQty: true, lowStockAt: true },
      }),
      db.codLedger.aggregate({ _sum: { amountPaise: true } }),
      db.user.count({ where: { createdAt: { gte: from } } }),
    ]);

    const delivered = orders.filter((o) => o.fulfillmentStatus === 'DELIVERED');
    const cancelled = orders.filter((o) => o.fulfillmentStatus === 'CANCELLED');
    const rejected = orders.filter((o) => o.fulfillmentStatus === 'REJECTED');
    const active = orders.filter((o) =>
      ['PLACED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(
        o.fulfillmentStatus,
      ),
    );

    // Revenue counts DELIVERED only — an order that never arrives isn't money.
    const revenuePaise = delivered.reduce((s, o) => s + o.finalPaise, 0);
    const prevDelivered = prevOrders.filter((o) => o.fulfillmentStatus === 'DELIVERED');
    const prevRevenue = prevDelivered.reduce((s, o) => s + o.finalPaise, 0);

    // Median, not mean: one 3-hour outlier shouldn't move the headline number.
    const durations = delivered
      .filter((o) => o.deliveredAt)
      .map((o) => (o.deliveredAt!.getTime() - o.placedAt.getTime()) / 60_000)
      .sort((a, b) => a - b);
    const medianDeliveryMinutes = durations.length
      ? Math.round(durations[Math.floor(durations.length / 2)]!)
      : null;

    const withEta = delivered.filter((o) => o.deliveredAt && o.etaHighMinutes != null);
    const onTime = withEta.filter(
      (o) => (o.deliveredAt!.getTime() - o.placedAt.getTime()) / 60_000 <= o.etaHighMinutes!,
    );
    const onTimePct = withEta.length
      ? Math.round((onTime.length / withEta.length) * 1000) / 10
      : null;

    const settled = delivered.length + cancelled.length + rejected.length;

    const lowStockCount = products.filter((p) => {
      const a = Math.max(0, p.stockQty - p.reservedQty);
      return a > 0 && a <= p.lowStockAt;
    }).length;
    const outOfStockCount = products.filter((p) => p.stockQty - p.reservedQty <= 0).length;

    // ── daily series (zero-filled so the chart has no gaps) ──
    const buckets = new Map<string, TimePointDto>();
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10);
      buckets.set(d, { date: d, revenuePaise: 0, orders: 0 });
    }
    for (const o of orders) {
      const key = o.placedAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.orders += 1;
      if (o.fulfillmentStatus === 'DELIVERED') b.revenuePaise += o.finalPaise;
    }

    const statusMix: StatusSliceDto[] = Object.entries(
      orders.reduce<Record<string, number>>((acc, o) => {
        acc[o.fulfillmentStatus] = (acc[o.fulfillmentStatus] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const ordersByHour: HourBucketDto[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: 0,
    }));
    for (const o of orders) ordersByHour[o.placedAt.getHours()]!.orders += 1;

    // ── top products + category revenue (delivered lines only) ──
    const deliveredIds = delivered.map((o) => o.id);
    let topProducts: TopProductDto[] = [];
    let categoryRevenue: Array<{ category: string; revenuePaise: number }> = [];

    if (deliveredIds.length > 0) {
      const lines = await db.orderItem.findMany({
        where: { orderId: { in: deliveredIds } },
        select: {
          productId: true,
          nameSnapshot: true,
          qty: true,
          lineTotalPaise: true,
          product: { select: { category: { select: { name: true } } } },
        },
      });

      const byProduct = new Map<string, TopProductDto>();
      const byCategory = new Map<string, number>();
      for (const l of lines) {
        const p = byProduct.get(l.productId) ?? {
          productId: l.productId,
          name: l.nameSnapshot,
          qty: 0,
          revenuePaise: 0,
        };
        p.qty += l.qty;
        p.revenuePaise += l.lineTotalPaise;
        byProduct.set(l.productId, p);

        const cat = l.product?.category?.name ?? 'Uncategorised';
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + l.lineTotalPaise);
      }
      topProducts = [...byProduct.values()]
        .sort((a, b) => b.revenuePaise - a.revenuePaise)
        .slice(0, 8);
      categoryRevenue = [...byCategory.entries()]
        .map(([category, revenuePaise]) => ({ category, revenuePaise }))
        .sort((a, b) => b.revenuePaise - a.revenuePaise);
    }

    return {
      rangeDays,
      kpis: {
        revenuePaise,
        revenueDeltaPct: this.pctDelta(revenuePaise, prevRevenue),
        orders: orders.length,
        ordersDeltaPct: this.pctDelta(orders.length, prevOrders.length),
        avgOrderValuePaise: delivered.length ? Math.round(revenuePaise / delivered.length) : 0,
        deliveredCount: delivered.length,
        cancelledCount: cancelled.length,
        rejectedCount: rejected.length,
        fulfilmentRatePct: settled
          ? Math.round((delivered.length / settled) * 1000) / 10
          : 0,
        activeOrders: active.length,
        codOutstandingPaise: codAgg._sum.amountPaise ?? 0,
        lowStockCount,
        outOfStockCount,
        newCustomers,
        medianDeliveryMinutes,
        onTimePct,
      },
      series: [...buckets.values()],
      statusMix,
      topProducts,
      ordersByHour,
      categoryRevenue,
    };
  }
}
