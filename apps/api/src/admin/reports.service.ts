import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;

/** RFC-4180 quoting: wrap when the value contains a comma, quote or newline. */
const cell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers: string[], rows: unknown[][]): string =>
  [headers.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n');

/** Prisma DECIMAL -> plain number. Quantities only; money stays integer paise. */
const qty = (d: Prisma.Decimal | number): number => Number(d);

const rupees = (paise: number) => (paise / 100).toFixed(2);
const iso = (d: Date | null) => (d ? d.toISOString() : '');

export type ReportKind = 'orders' | 'cod' | 'products' | 'drivers';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-A-007. Returns CSV text; the controller sets the download headers. */
  async generate(kind: ReportKind, rangeDays: number): Promise<{ filename: string; csv: string }> {
    const db = this.prisma.db;
    const from = new Date(Date.now() - rangeDays * DAY_MS);
    const stamp = new Date().toISOString().slice(0, 10);

    if (kind === 'orders') {
      const rows = await db.order.findMany({
        where: { placedAt: { gte: from } },
        include: {
          items: true,
          user: { select: { phone: true, name: true } },
          store: { select: { name: true } },
          driver: { select: { name: true } },
          address: { select: { street: true, city: true, pincode: true } },
        },
        orderBy: { placedAt: 'desc' },
      });
      return {
        filename: `hill-express-orders-${stamp}.csv`,
        csv: toCsv(
          [
            'orderNumber','placedAt','status','assignment','customer','phone','store','driver',
            'area','pincode','items','itemTotal','deliveryFee','total','codDue','codCollected',
            'paymentStatus','acceptedAt','deliveredAt','etaLowMin','etaHighMin','actualMinutes',
          ],
          rows.map((o) => [
            o.orderNumber,
            iso(o.placedAt),
            o.fulfillmentStatus,
            o.assignmentStatus,
            o.user.name ?? '',
            o.user.phone,
            o.store.name,
            o.driver?.name ?? '',
            `${o.address.street}, ${o.address.city}`,
            o.address.pincode,
            o.items.reduce((n, i) => n + qty(i.qty), 0),
            rupees(o.itemTotalPaise),
            rupees(o.deliveryFeePaise),
            rupees(o.finalPaise),
            rupees(o.codDuePaise),
            rupees(o.codCollectedPaise),
            o.paymentStatus,
            iso(o.acceptedAt),
            iso(o.deliveredAt),
            o.etaLowMinutes ?? '',
            o.etaHighMinutes ?? '',
            o.deliveredAt
              ? Math.round((o.deliveredAt.getTime() - o.placedAt.getTime()) / 60_000)
              : '',
          ]),
        ),
      };
    }

    if (kind === 'cod') {
      const rows = await db.codLedger.findMany({
        where: { createdAt: { gte: from } },
        include: {
          driver: { select: { name: true, phone: true } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        filename: `hill-express-cod-${stamp}.csv`,
        csv: toCsv(
          ['createdAt', 'driver', 'driverPhone', 'orderNumber', 'entryType', 'amount', 'note'],
          rows.map((e) => [
            iso(e.createdAt),
            e.driver.name,
            e.driver.phone,
            e.order?.orderNumber ?? '',
            e.entryType,
            rupees(e.amountPaise),
            e.note ?? '',
          ]),
        ),
      };
    }

    if (kind === 'products') {
      const rows = await db.product.findMany({
        where: { deletedAt: null },
        include: { category: { select: { name: true } }, store: { select: { name: true } } },
        orderBy: { name: 'asc' },
      });
      return {
        filename: `hill-express-inventory-${stamp}.csv`,
        csv: toCsv(
          ['sku','name','category','store','unit','packSize','price','mrp','stock','reserved','available','lowStockAt','visible'],
          rows.map((p) => [
            p.sku ?? '',
            p.name,
            p.category.name,
            p.store.name,
            p.unit,
            p.packSize,
            rupees(p.pricePaise),
            p.mrpPaise ? rupees(p.mrpPaise) : '',
            qty(p.stockQty),
            qty(p.reservedQty),
            qty(p.stockQty) - qty(p.reservedQty),
            qty(p.lowStockAt),
            p.isAvailable ? 'yes' : 'no',
          ]),
        ),
      };
    }

    // drivers
    const drivers = await db.driver.findMany({ orderBy: { name: 'asc' } });
    const rows = await Promise.all(
      drivers.map(async (d) => {
        const [ledger, deliveredCount] = await Promise.all([
          db.codLedger.aggregate({ where: { driverId: d.id }, _sum: { amountPaise: true } }),
          db.order.count({ where: { driverId: d.id, deliveredAt: { gte: from } } }),
        ]);
        return [
          d.name,
          d.phone,
          d.status,
          d.vehicleNumber ?? '',
          rupees(ledger._sum.amountPaise ?? 0),
          rupees(d.codLimitPaise),
          deliveredCount,
          iso(d.lastSeenAt),
        ];
      }),
    );
    return {
      filename: `hill-express-drivers-${stamp}.csv`,
      csv: toCsv(
        ['name','phone','status','vehicle','codOutstanding','codLimit','deliveredInRange','lastSeenAt'],
        rows,
      ),
    };
  }
}
