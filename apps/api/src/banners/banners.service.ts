import { Injectable, NotFoundException } from '@nestjs/common';
import type { Banner } from '@prisma/client';
import type { AdminBannerDto, BannerDto, SaveBannerInput } from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Empty strings arrive from HTML forms; the DB wants real nulls. */
const orNull = (v: string | undefined | null): string | null =>
  v == null || v.trim() === '' ? null : v.trim();

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  private isLive(b: Banner, now = new Date()): boolean {
    if (!b.isActive) return false;
    if (b.startsAt && b.startsAt > now) return false;
    if (b.endsAt && b.endsAt < now) return false;
    return true;
  }

  private toPublic(b: Banner): BannerDto {
    return {
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: b.imageUrl,
      bgColor: b.bgColor,
      ctaLabel: b.ctaLabel,
      linkType: b.linkType,
      linkValue: b.linkValue,
    };
  }

  private toAdmin(b: Banner): AdminBannerDto {
    return {
      ...this.toPublic(b),
      storeId: b.storeId,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
      liveNow: this.isLive(b),
    };
  }

  /**
   * Customer feed. The date window is filtered HERE, not by a nightly job —
   * a Diwali banner stops showing the moment it expires, even if nobody is
   * around to switch it off.
   */
  async feed(storeId?: string): Promise<BannerDto[]> {
    const now = new Date();
    const rows = await this.prisma.db.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          // null storeId = shown in every store
          { OR: [{ storeId: null }, ...(storeId ? [{ storeId }] : [])] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    });
    return rows.map((b) => this.toPublic(b));
  }

  // ── admin ──────────────────────────────────────────────────────────
  async list(): Promise<AdminBannerDto[]> {
    const rows = await this.prisma.db.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((b) => this.toAdmin(b));
  }

  private toData(input: SaveBannerInput) {
    return {
      title: input.title.trim(),
      subtitle: orNull(input.subtitle),
      imageUrl: orNull(input.imageUrl),
      bgColor: input.bgColor,
      ctaLabel: orNull(input.ctaLabel),
      linkType: input.linkType,
      linkValue: orNull(input.linkValue),
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    };
  }

  async create(input: SaveBannerInput): Promise<AdminBannerDto> {
    const created = await this.prisma.db.banner.create({ data: this.toData(input) });
    return this.toAdmin(created);
  }

  async update(id: string, input: SaveBannerInput): Promise<AdminBannerDto> {
    const existing = await this.prisma.db.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    const updated = await this.prisma.db.banner.update({
      where: { id },
      data: this.toData(input),
    });
    return this.toAdmin(updated);
  }

  /** Quick on/off from the list, without opening the whole form. */
  async setActive(id: string, isActive: boolean): Promise<AdminBannerDto> {
    const existing = await this.prisma.db.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    const updated = await this.prisma.db.banner.update({ where: { id }, data: { isActive } });
    return this.toAdmin(updated);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.db.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    await this.prisma.db.banner.delete({ where: { id } });
    return { ok: true };
  }
}
