import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Banner } from '@prisma/client';
import type { AdminBannerDto, BannerDto, SaveBannerInput } from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

/** Empty strings arrive from HTML forms; the DB wants real nulls. */
const orNull = (v: string | undefined | null): string | null =>
  v == null || v.trim() === '' ? null : v.trim();

@Injectable()
export class BannersService implements OnModuleInit {
  private readonly log = new Logger(BannersService.name);
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Artwork uploaded but never saved onto a banner would otherwise sit on disk
   * forever — abandoning a half-filled form is the normal case, not the edge
   * case. Swept daily, and only files older than the sweeper's age floor are
   * eligible, so a file backing an unsaved draft is never pulled out from
   * under the person still filling in the form.
   */
  onModuleInit(): void {
    if (!this.prisma.isConfigured) return;
    const run = () => {
      void this.sweepUploads().catch((e) =>
        this.log.warn(`upload sweep failed: ${e instanceof Error ? e.message : e}`),
      );
    };
    this.sweepTimer = setInterval(run, 24 * 3_600_000);
    this.sweepTimer.unref(); // never hold the process open
    setTimeout(run, 60_000).unref(); // once shortly after boot
  }

  private async sweepUploads(): Promise<void> {
    const rows = await this.prisma.db.banner.findMany({ select: { imageUrl: true } });
    const referenced = new Set(rows.map((r) => r.imageUrl).filter((u): u is string => !!u));
    await this.uploads.sweepOrphans(referenced);
  }

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
    // Swapping the artwork orphans the old file — bin it after the write
    // succeeds, and only if it is genuinely a different one.
    if (existing.imageUrl && existing.imageUrl !== updated.imageUrl) {
      await this.uploads.removeByUrl(existing.imageUrl);
    }
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
    await this.uploads.removeByUrl(existing.imageUrl);
    return { ok: true };
  }
}
