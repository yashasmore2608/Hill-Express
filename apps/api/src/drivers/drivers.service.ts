import { Injectable, NotFoundException } from '@nestjs/common';
import type { DriverSummaryDto } from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async summary(driverId: string): Promise<DriverSummaryDto> {
    const db = this.prisma.db;
    const driver = await db.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [ledger, deliveredToday] = await Promise.all([
      db.codLedger.aggregate({ where: { driverId }, _sum: { amountPaise: true } }),
      db.order.count({ where: { driverId, deliveredAt: { gte: startOfDay } } }),
    ]);

    return {
      id: driver.id,
      name: driver.name,
      status: driver.status,
      codOutstandingPaise: ledger._sum.amountPaise ?? 0,
      codLimitPaise: driver.codLimitPaise,
      deliveredToday,
    };
  }

  async setStatus(driverId: string, status: 'AVAILABLE' | 'OFFLINE') {
    const db = this.prisma.db;
    // Going off duty with deliveries on board is not a thing.
    if (status === 'OFFLINE') {
      const active = await db.order.count({
        where: {
          driverId,
          fulfillmentStatus: { in: ['ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
        },
      });
      if (active > 0) {
        throw new NotFoundException('Finish your current deliveries before going off duty');
      }
    }
    const driver = await db.driver.update({ where: { id: driverId }, data: { status } });
    return { status: driver.status };
  }

  async updateLocation(driverId: string, lat: number, lng: number) {
    await this.prisma.db.driver.update({
      where: { id: driverId },
      data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date() },
    });
    return { ok: true as const };
  }
}
