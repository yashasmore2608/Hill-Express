import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Address } from '@prisma/client';
import {
  LIMITS,
  type AddressDto,
  type PatchAddressInput,
  type SaveAddressInput,
  type ServiceabilityDto,
} from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(a: Address): AddressDto {
    return {
      id: a.id,
      label: a.label,
      house: a.house,
      street: a.street,
      landmark: a.landmark,
      city: a.city,
      pincode: a.pincode,
      lat: a.lat,
      lng: a.lng,
      instructions: a.instructions,
      zoneId: a.zoneId,
      serviceable: a.zoneId !== null,
    };
  }

  private async resolveZone(pincode: string): Promise<string | null> {
    const zone = await this.prisma.db.deliveryZone.findFirst({
      where: { isActive: true, pincodes: { has: pincode } },
    });
    if (zone) return zone.id;

    // Dev escape hatch: serve everywhere so the full flow is testable from any
    // address. Production leaves SERVICE_ALL_PINCODES unset and this returns
    // null, which is what makes an address "outside our delivery area".
    if (env.SERVICE_ALL_PINCODES) {
      const fallback = await this.prisma.db.deliveryZone.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      return fallback?.id ?? null;
    }
    return null;
  }

  /** Public wrapper so order placement can re-check coverage. */
  resolveZoneFor(pincode: string): Promise<string | null> {
    return this.resolveZone(pincode);
  }

  async serviceability(pincode: string): Promise<ServiceabilityDto> {
    const zoneId = await this.resolveZone(pincode);
    return { serviceable: zoneId !== null, zoneId };
  }

  async list(userId: string): Promise<AddressDto[]> {
    const rows = await this.prisma.db.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    // Self-healing: an address saved while its area was unserviceable (or
    // before a zone existed) re-resolves on read, so newly covered pincodes
    // start working without the customer re-entering anything.
    const healed = await Promise.all(
      rows.map(async (a) => {
        if (a.zoneId) return a;
        const zoneId = await this.resolveZone(a.pincode);
        if (!zoneId) return a;
        return this.prisma.db.address.update({ where: { id: a.id }, data: { zoneId } });
      }),
    );
    return healed.map((a) => this.toDto(a));
  }

  async get(userId: string, id: string): Promise<AddressDto> {
    const a = await this.prisma.db.address.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!a) throw new NotFoundException('Address not found');
    return this.toDto(a);
  }

  async create(userId: string, input: SaveAddressInput): Promise<AddressDto> {
    const db = this.prisma.db;

    // FR-C-003: hard cap. The message tells the user the way out.
    const count = await db.address.count({ where: { userId, deletedAt: null } });
    if (count >= LIMITS.maxAddresses) {
      throw new BadRequestException(
        `Address limit is ${LIMITS.maxAddresses} — delete one to add another`,
      );
    }

    const zoneId = await this.resolveZone(input.pincode);
    const created = await db.address.create({
      data: { userId, ...input, zoneId },
    });
    return this.toDto(created);
  }

  async update(userId: string, id: string, input: PatchAddressInput): Promise<AddressDto> {
    const db = this.prisma.db;
    const existing = await db.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Address not found');

    // Re-resolve the zone only when the pincode is part of the edit — otherwise
    // fixing a flat number would needlessly re-run serviceability.
    const zoneId =
      input.pincode !== undefined ? await this.resolveZone(input.pincode) : existing.zoneId;
    const updated = await db.address.update({ where: { id }, data: { ...input, zoneId } });
    return this.toDto(updated);
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const db = this.prisma.db;
    const existing = await db.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Address not found');
    // Soft delete — past orders keep pointing at a real row.
    await db.address.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
