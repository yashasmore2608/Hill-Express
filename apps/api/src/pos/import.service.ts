import { BadRequestException, Injectable } from '@nestjs/common';
import {
  IMPORT_HEADERS,
  importRowSchema,
  rupeesToPaise,
  type ImportRequestInput,
  type ImportResultDto,
  type ImportRowErrorDto,
} from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv } from './csv';

/**
 * FR-P-006 bulk import. Per-row processing, NOT one giant transaction:
 * a typo on row 40 must not throw away rows 1–39 — the operator fixes the
 * reported rows and re-imports. Re-import is an upsert on (storeId, sku),
 * so running the same file twice is harmless.
 *
 * Runs inline today (a kirana file is hundreds of rows, well under a
 * request budget). When Redis lands (M12) this moves onto the queue
 * unchanged — the service interface doesn't care who calls it.
 */
@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async run(storeId: string, actorId: string, input: ImportRequestInput): Promise<ImportResultDto> {
    const db = this.prisma.db;

    const rows = parseCsv(input.content);
    if (rows.length < 2) throw new BadRequestException('CSV needs a header row and at least one data row');

    // Header mapping — order-insensitive, case-insensitive.
    const header = (rows[0] ?? []).map((h) => h.trim());
    const idx = new Map<string, number>();
    for (const want of IMPORT_HEADERS) {
      const at = header.findIndex((h) => h.toLowerCase() === want.toLowerCase());
      if (at >= 0) idx.set(want, at);
    }
    for (const required of ['sku', 'name', 'category', 'unit', 'packSize', 'price', 'stock']) {
      if (!idx.has(required)) {
        throw new BadRequestException(
          `CSV is missing the "${required}" column. Expected: ${IMPORT_HEADERS.join(', ')}`,
        );
      }
    }

    const job = await db.importJob.create({
      data: {
        storeId,
        uploadedBy: actorId,
        fileName: input.fileName,
        status: 'PROCESSING',
        totalRows: rows.length - 1,
      },
    });

    const errors: ImportRowErrorDto[] = [];
    let created = 0;
    let updated = 0;
    const categoryCache = new Map<string, string>();

    for (let r = 1; r < rows.length; r++) {
      const rowNumber = r + 1; // 1-based, counting the header
      const raw = rows[r] ?? [];
      const get = (key: string) => raw[idx.get(key) ?? -1]?.trim() ?? '';

      const parsed = importRowSchema.safeParse({
        sku: get('sku'),
        name: get('name'),
        category: get('category'),
        unit: get('unit'),
        packSize: get('packSize'),
        price: get('price'),
        mrp: idx.has('mrp') ? get('mrp') : null,
        stock: get('stock'),
        lowStockAt: idx.has('lowStockAt') && get('lowStockAt') !== '' ? get('lowStockAt') : undefined,
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ rowNumber, message: `${issue?.path.join('.')}: ${issue?.message}` });
        continue;
      }
      const row = parsed.data;

      try {
        // Category: find-or-create per store, cached per run.
        let categoryId = categoryCache.get(row.category.toLowerCase());
        if (!categoryId) {
          const existing = await db.category.findFirst({
            where: { storeId, name: { equals: row.category, mode: 'insensitive' }, deletedAt: null },
          });
          if (existing) categoryId = existing.id;
          else {
            const count = await db.category.count({ where: { storeId } });
            categoryId = (
              await db.category.create({
                data: { storeId, name: row.category, sortOrder: count },
              })
            ).id;
          }
          categoryCache.set(row.category.toLowerCase(), categoryId);
        }

        const data = {
          name: row.name,
          categoryId,
          unit: row.unit,
          packSize: row.packSize,
          pricePaise: rupeesToPaise(row.price),
          mrpPaise: row.mrp != null ? rupeesToPaise(row.mrp) : null,
          ...(row.lowStockAt !== undefined ? { lowStockAt: row.lowStockAt } : {}),
        };

        const existing = await db.product.findUnique({
          where: { storeId_sku: { storeId, sku: row.sku } },
        });

        if (existing) {
          const stockDelta = row.stock - Number(existing.stockQty);
          await db.$transaction([
            db.product.update({
              where: { id: existing.id },
              data: { ...data, stockQty: row.stock },
            }),
            ...(stockDelta !== 0
              ? [
                  db.stockLedger.create({
                    data: {
                      productId: existing.id,
                      storeId,
                      delta: stockDelta,
                      reason: 'IMPORT',
                      importJobId: job.id,
                      actorType: 'STORE',
                      actorId,
                    },
                  }),
                ]
              : []),
          ]);
          updated++;
        } else {
          const createdProduct = await db.product.create({
            data: { storeId, sku: row.sku, stockQty: row.stock, ...data },
          });
          if (row.stock > 0) {
            await db.stockLedger.create({
              data: {
                productId: createdProduct.id,
                storeId,
                delta: row.stock,
                reason: 'IMPORT',
                importJobId: job.id,
                actorType: 'STORE',
                actorId,
              },
            });
          }
          created++;
        }
      } catch {
        errors.push({ rowNumber, message: 'Could not save this row — check values and retry' });
      }
    }

    // Persist row errors + finalize job counters.
    if (errors.length > 0) {
      await db.importRowError.createMany({
        data: errors.map((e) => ({ importJobId: job.id, rowNumber: e.rowNumber, message: e.message })),
      });
    }
    const successRows = created + updated;
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        successRows,
        errorRows: errors.length,
        finishedAt: new Date(),
      },
    });

    return {
      jobId: job.id,
      fileName: input.fileName,
      totalRows: rows.length - 1,
      successRows,
      errorRows: errors.length,
      created,
      updated,
      errors: errors.slice(0, 50), // response cap; full list stays queryable
    };
  }
}
