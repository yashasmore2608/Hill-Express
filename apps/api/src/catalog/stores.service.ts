import { Injectable, NotFoundException } from '@nestjs/common';
import type { DeliveryConfig, Store } from '@prisma/client';
import { computeEta, HILL_DEFAULTS, type StoreSummaryDto } from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(store: Store, config: DeliveryConfig | null): StoreSummaryDto {
    // Teaser range before an address exists: prep + driver leg + dwells +
    // buffer, zero drop distance. The real per-address ETA lands at checkout.
    const cfg = config
      ? {
          roadFactor: config.roadFactor,
          avgSpeedKmph: config.avgSpeedKmph,
          avgSpeedUphillKmph: config.avgSpeedUphill,
          avgSpeedDownhillKmph: config.avgSpeedDownhill,
          pickupDwellMin: config.pickupDwellMin,
          dropDwellMin: config.dropDwellMin,
          safetyBufferMin: config.safetyBufferMin,
          etaRangeLowPct: config.etaRangeLowPct,
          etaRangeHighPct: config.etaRangeHighPct,
        }
      : HILL_DEFAULTS;
    const eta = computeEta(
      {
        prepMinutes: store.defaultPrepMin,
        store: { lat: store.lat, lng: store.lng },
        customer: { lat: store.lat, lng: store.lng },
      },
      cfg,
    );
    return {
      id: store.id,
      name: store.name,
      code: store.code,
      isOpen: store.isOpen && !store.isBlocked,
      deliveryFeePaise: store.deliveryFeePaise,
      freeDeliveryAbovePaise: store.freeDeliveryAbovePaise,
      openTime: store.openTime,
      closeTime: store.closeTime,
      etaLowMinutes: eta.lowMinutes,
      etaHighMinutes: eta.highMinutes,
    };
  }

  async list(pincode?: string): Promise<StoreSummaryDto[]> {
    const db = this.prisma.db;
    const zoneFilter = pincode
      ? { zone: { isActive: true, pincodes: { has: pincode } } }
      : { zone: { isActive: true } };
    const stores = await db.store.findMany({
      where: { isBlocked: false, ...zoneFilter },
      include: { config: true, zone: { include: { config: true } } },
      orderBy: { createdAt: 'asc' },
    });
    // Store-level config wins over zone-level, falls back to hill defaults.
    return stores.map((s) => this.toSummary(s, s.config ?? s.zone.config));
  }

  async get(id: string): Promise<StoreSummaryDto> {
    const db = this.prisma.db;
    const store = await db.store.findUnique({
      where: { id },
      include: { config: true, zone: { include: { config: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    return this.toSummary(store, store.config ?? store.zone.config);
  }
}
