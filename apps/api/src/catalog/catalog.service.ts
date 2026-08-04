import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  decodeCursor,
  encodeCursor,
  type CategoryDto,
  type ProductDto,
  type ProductPageDto,
  type ProductsQueryInput,
} from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toProductDto } from './product.mapper';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async categories(storeId: string): Promise<CategoryDto[]> {
    const db = this.prisma.db;
    const cats = await db.category.findMany({
      where: { storeId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
      },
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      productCount: c._count.products,
    }));
  }

  /**
   * Two read paths, deliberately different shapes:
   *  - BROWSE: keyset pagination on (name, id) — page 400 costs the same as
   *    page 1. OFFSET is banned repo-wide; this is the pattern lists copy.
   *  - SEARCH: relevance-ranked (tsvector + trigram), capped at 50 — ranked
   *    results don't paginate meaningfully and nobody scrolls past rank 50.
   */
  async products(storeId: string, q: ProductsQueryInput): Promise<ProductPageDto> {
    if (q.search) return this.search(storeId, q.search, q.categoryId);

    const db = this.prisma.db;

    const base: Prisma.ProductWhereInput = {
      storeId,
      deletedAt: null,
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    };

    const cur = q.cursor ? decodeCursor(q.cursor) : null;
    const where: Prisma.ProductWhereInput = cur
      ? {
          AND: [
            base,
            { OR: [{ name: { gt: cur.n } }, { name: cur.n, id: { gt: cur.i } }] },
          ],
        }
      : base;

    const rows = await db.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: q.limit + 1, // one extra row = "is there a next page?" without COUNT
    });

    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toProductDto),
      nextCursor:
        rows.length > q.limit && last ? encodeCursor({ n: last.name, i: last.id }) : null,
    };
  }

  /**
   * FR-C-007. Four matchers OR'd, best rank first:
   *   websearch_to_tsquery  — word/phrase matches ("amul butter")
   *   pg_trgm word_similarity — typo tolerance ("aata" → "Atta"; word-level,
   *                             because full-string similarity drowns short
   *                             terms in long product names)
   *   substring ILIKE       — mid-word typing ("brea" → "Brown Bread")
   *   category name         — "biscuits" finds Parle-G even though no
   *                           product is literally named biscuit
   */
  private async search(
    storeId: string,
    term: string,
    categoryId?: string,
  ): Promise<ProductPageDto> {
    const db = this.prisma.db;

    const ranked = await db.$queryRaw<{ id: string }[]>`
      SELECT p."id"
      FROM "Product" p
      JOIN "Category" c ON c."id" = p."categoryId"
      WHERE p."storeId" = ${storeId}
        AND p."deletedAt" IS NULL
        AND (${categoryId ?? null}::text IS NULL OR p."categoryId" = ${categoryId ?? null})
        AND (
          p."searchVector" @@ websearch_to_tsquery('simple', ${term})
          OR word_similarity(${term}, p."name") > 0.4
          OR p."name" ILIKE '%' || ${term} || '%'
          OR c."name" ILIKE '%' || ${term} || '%'
        )
      ORDER BY
        ts_rank(p."searchVector", websearch_to_tsquery('simple', ${term})) DESC,
        word_similarity(${term}, p."name") DESC,
        p."name" ASC
      LIMIT 50`;

    if (ranked.length === 0) return { items: [], nextCursor: null };

    const rows = await db.product.findMany({ where: { id: { in: ranked.map((r) => r.id) } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      // Preserve relevance order — findMany returns rows unordered.
      items: ranked.flatMap((r) => {
        const row = byId.get(r.id);
        return row ? [toProductDto(row)] : [];
      }),
      nextCursor: null,
    };
  }

  async product(id: string): Promise<ProductDto> {
    const db = this.prisma.db;
    const p = await db.product.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException('Product not found');
    return toProductDto(p);
  }
}
