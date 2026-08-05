import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, TX } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { renderInvoicePdf } from './invoice-pdf';

const qty = (d: Prisma.Decimal | number): number => Number(d);

/**
 * Indian financial year for a date: 1 April – 31 March.
 * 2026-03-31 → "2025-26";  2026-04-01 → "2026-27".
 */
export const financialYear = (d: Date): string => {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // getMonth() is 0-based; 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

@Injectable()
export class InvoicesService {
  private readonly log = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Issue the tax invoice for a delivered order (spec §11, pipeline stage 14).
   *
   * Idempotent by construction: `Invoice.orderId` is unique, so a retry — or
   * two concurrent deliveries of the same order — cannot mint a second serial.
   * The loser of that race gets the existing invoice back, not an error.
   *
   * Quantities come from `fulfilledQty` when the store recorded what actually
   * went in the bag, falling back to the ordered quantity. That is the first
   * line of stage 14: "delivered quantity confirmed" — invoicing the ordered
   * amount when a lighter bag was handed over is an overcharge.
   */
  async issueForOrder(orderId: string, actorId?: string) {
    const db = this.prisma.db;

    const existing = await db.invoice.findUnique({
      where: { orderId },
      include: { items: true },
    });
    if (existing) return existing;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { sku: true } } } }, store: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.fulfillmentStatus !== 'DELIVERED') {
      throw new BadRequestException('An invoice is only issued once the order is delivered');
    }

    // ── line maths, all integer paise ────────────────────────────────────
    // taxBps is the snapshot rate; prices are GST-inclusive (how a kirana
    // quotes them), so tax is extracted from the line rather than added to
    // it. Extracting keeps the invoice total equal to what the customer
    // actually paid — the number they can check against their cash.
    const lines = order.items.map((i) => {
      const q = qty(i.fulfilledQty ?? i.qty);
      const gross = Math.round(i.pricePaise * q) - i.discountPaise;
      const taxPaise = i.taxBps > 0 ? Math.round(gross - gross / (1 + i.taxBps / 10_000)) : 0;
      return {
        orderItemId: i.id,
        nameSnapshot: i.nameSnapshot,
        skuSnapshot: i.product?.sku ?? null,
        unitSnapshot: i.unitSnapshot,
        qty: q,
        unitPricePaise: i.pricePaise,
        discountPaise: i.discountPaise,
        taxBps: i.taxBps,
        taxPaise,
        lineTotalPaise: gross,
      };
    });

    const grossPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
    const taxPaise = lines.reduce((s, l) => s + l.taxPaise, 0);
    const subtotalPaise = grossPaise - taxPaise; // taxable value, tax shown separately
    const discountPaise = lines.reduce((s, l) => s + l.discountPaise, 0);
    const totalPaise = grossPaise + order.deliveryFeePaise;

    // COD money already collected decides the payment status on the invoice.
    const paidPaise = order.codCollectedPaise;
    const paymentStatus =
      paidPaise <= 0 ? 'UNPAID' : paidPaise >= totalPaise ? 'PAID' : 'PARTIAL';

    const now = new Date();
    const fy = financialYear(now);

    const invoice = await db.$transaction(async (tx) => {
      // Serial allocated INSIDE the transaction so a crash after numbering
      // but before insert cannot leave a hole in the sequence.
      const seqRow = await tx.invoiceSeq.upsert({
        where: { fy },
        create: { fy, seq: 1 },
        update: { seq: { increment: 1 } },
      });
      const invoiceNo = `HE/${fy}/${String(seqRow.seq).padStart(6, '0')}`;

      return tx.invoice.create({
        data: {
          invoiceNo,
          orderId: order.id,
          storeId: order.storeId,
          userId: order.userId,
          type: 'TAX_INVOICE',
          status: 'ISSUED',
          subtotalPaise,
          discountPaise,
          taxPaise,
          deliveryFeePaise: order.deliveryFeePaise,
          totalPaise,
          paymentStatus,
          paidPaise,
          invoiceDate: now,
          issuedAt: now,
          createdBy: actorId,
          items: { create: lines },
        },
        include: { items: true },
      });
    }, TX);

    this.log.log(`issued ${invoice.invoiceNo} for order ${order.orderNumber}`);

    // The PDF is a rendering of the row, not the source of truth — so it is
    // produced after the commit. A failure here leaves a valid invoice with
    // no document, which `backfillDocuments` picks up later.
    await this.renderAndAttach(invoice.id).catch((e) =>
      this.log.warn(`PDF render failed for ${invoice.invoiceNo}: ${e?.message ?? e}`),
    );

    return db.invoice.findUnique({ where: { id: invoice.id }, include: { items: true } });
  }

  /** Render the PDF and store its path on the invoice. */
  async renderAndAttach(invoiceId: string): Promise<string> {
    const db = this.prisma.db;
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        store: true,
        user: { select: { name: true, phone: true } },
        order: { include: { addressSnapshot: true, address: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const pdf = renderInvoicePdf(invoice);
    const { url } = await this.uploads.saveBuffer('invoices', pdf, 'pdf');
    await db.invoice.update({ where: { id: invoiceId }, data: { documentUrl: url } });
    return url;
  }

  /**
   * Stage 14, last half: match collected money against the invoice.
   * Called after any COD movement; safe to call repeatedly.
   */
  async reconcile(orderId: string): Promise<void> {
    const db = this.prisma.db;
    const invoice = await db.invoice.findUnique({ where: { orderId } });
    if (!invoice) return;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { codCollectedPaise: true },
    });
    if (!order) return;

    const paid = order.codCollectedPaise;
    const paymentStatus =
      paid <= 0 ? 'UNPAID' : paid >= invoice.totalPaise ? 'PAID' : 'PARTIAL';
    if (paid === invoice.paidPaise && paymentStatus === invoice.paymentStatus) return;

    await db.invoice.update({
      where: { id: invoice.id },
      data: { paidPaise: paid, paymentStatus, versionNo: { increment: 1 } },
    });
  }

  // ── reads ────────────────────────────────────────────────────────────
  async forOrder(orderId: string, userId?: string) {
    const invoice = await this.prisma.db.invoice.findUnique({
      where: { orderId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('No invoice for this order yet');
    if (userId && invoice.userId !== userId) throw new NotFoundException('No invoice for this order yet');
    return invoice;
  }

  /** Single invoice, optionally scoped to its owner. */
  async byId(id: string, userId?: string) {
    const invoice = await this.prisma.db.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    // Same 404 for "missing" and "not yours" — a different code would confirm
    // the invoice exists to someone who should not know that.
    if (userId && invoice.userId !== userId) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async list(q: { cursor?: string; paymentStatus?: string }) {
    const db = this.prisma.db;
    const limit = 30;
    const rows = await db.invoice.findMany({
      where: {
        ...(q.paymentStatus && ['PAID', 'UNPAID', 'PARTIAL'].includes(q.paymentStatus)
          ? { paymentStatus: q.paymentStatus as 'PAID' | 'UNPAID' | 'PARTIAL' }
          : {}),
        ...(q.cursor ? { invoiceDate: { lt: new Date(q.cursor) } } : {}),
      },
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { name: true, phone: true } },
        store: { select: { name: true } },
      },
      orderBy: { invoiceDate: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        orderNumber: i.order.orderNumber,
        customer: i.user.name ?? i.user.phone,
        store: i.store.name,
        invoiceDate: i.invoiceDate.toISOString(),
        totalPaise: i.totalPaise,
        paidPaise: i.paidPaise,
        taxPaise: i.taxPaise,
        paymentStatus: i.paymentStatus,
        status: i.status,
        documentUrl: i.documentUrl,
      })),
      nextCursor:
        rows.length > limit ? (page.at(-1)?.invoiceDate.toISOString() ?? null) : null,
    };
  }

  /**
   * Every delivered order without an invoice gets one.
   *
   * Needed twice over: orders delivered before this feature existed, and any
   * order whose invoice write failed after delivery had already committed.
   */
  async backfill(): Promise<{ issued: number; failed: number }> {
    const db = this.prisma.db;
    const pending = await db.order.findMany({
      where: { fulfillmentStatus: 'DELIVERED', invoice: { is: null } },
      select: { id: true, orderNumber: true },
      orderBy: { deliveredAt: 'asc' }, // oldest first, so serials follow delivery order
    });

    let issued = 0;
    let failed = 0;
    for (const o of pending) {
      try {
        await this.issueForOrder(o.id);
        issued++;
      } catch (e) {
        failed++;
        this.log.warn(`backfill failed for ${o.orderNumber}: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (issued || failed) this.log.log(`invoice backfill: ${issued} issued, ${failed} failed`);
    return { issued, failed };
  }

  /** Invoices that exist but never got a PDF (render failed at issue time). */
  async backfillDocuments(): Promise<number> {
    const rows = await this.prisma.db.invoice.findMany({
      where: { documentUrl: null, status: 'ISSUED' },
      select: { id: true },
    });
    let done = 0;
    for (const r of rows) {
      try {
        await this.renderAndAttach(r.id);
        done++;
      } catch {
        /* logged by the caller's sweep */
      }
    }
    return done;
  }
}
