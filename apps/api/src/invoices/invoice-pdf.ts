import type { Prisma } from '@prisma/client';
import { PAGE, Pdf, fit } from './pdf';

/** Spruce, the brand colour, as a 0–1 RGB triple for the PDF band. */
const SPRUCE: [number, number, number] = [0.043, 0.239, 0.18];

/** "Rs." not "₹" — see the encoding note in pdf.ts. */
const money = (paise: number): string =>
  `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const plain = (paise: number): string =>
  (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qtyLabel = (q: number, unit: string): string => {
  const n = Math.round(q * 1000) / 1000;
  if (unit === 'KG') return n < 1 ? `${Math.round(n * 1000)} g` : `${n} kg`;
  if (unit === 'LITRE') return n < 1 ? `${Math.round(n * 1000)} ml` : `${n} L`;
  return String(n);
};

const dateLabel = (d: Date): string =>
  d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type InvoiceForPdf = Prisma.InvoiceGetPayload<{
  include: {
    items: true;
    store: true;
    user: { select: { name: true; phone: true } };
    order: { include: { addressSnapshot: true; address: true } };
  };
}>;

const M = 42; // page margin
const RIGHT = PAGE.w - M;

/**
 * One-page A4 tax invoice.
 *
 * Column positions are fixed and the money columns are right-aligned off
 * measured text widths, so the decimal points line up down the page — a
 * ragged amount column is the first thing that makes an invoice look fake.
 */
export function renderInvoicePdf(inv: InvoiceForPdf): Buffer {
  const p = new Pdf();

  // The snapshot is the truth for anything delivered after Phase A. Orders
  // from before it fall back to the live address row, which has no recipient
  // columns — so those come off the account instead. Both shapes are
  // flattened here rather than branched on further down.
  const snap = inv.order.addressSnapshot;
  const live = inv.order.address;
  const addr = {
    recipientName: snap?.recipientName ?? inv.user.name ?? 'Customer',
    recipientMobile: snap?.recipientMobile ?? inv.user.phone,
    house: snap?.house ?? live.house,
    street: snap?.street ?? live.street,
    landmark: snap?.landmark ?? live.landmark,
    city: snap?.city ?? live.city,
    pincode: snap?.pincode ?? live.pincode,
  };

  // ── header band ──────────────────────────────────────────────────────
  p.rectRgb(0, 0, PAGE.w, 92, SPRUCE);
  p.textRgb(M, 40, 'HILL EXPRESS', 20, 'HB', [1, 1, 1]);
  p.textRgb(M, 58, inv.store.name, 9.5, 'H', [0.82, 0.9, 0.86]);
  p.textRgb(M, 72, `${inv.store.addressLine}  ·  ${inv.store.phone}`, 8.5, 'H', [0.7, 0.82, 0.77]);

  p.textRgb(RIGHT - 96, 38, 'TAX INVOICE', 13, 'HB', [1, 1, 1]);
  p.textRgb(RIGHT - 96, 56, inv.invoiceNo, 9.5, 'H', [0.82, 0.9, 0.86]);
  p.textRgb(RIGHT - 96, 70, dateLabel(inv.invoiceDate), 8.5, 'H', [0.7, 0.82, 0.77]);

  // ── parties ──────────────────────────────────────────────────────────
  let y = 128;
  p.text(M, y, 'BILLED TO', 8, 'HB', 0.45);
  p.text(M + 268, y, 'ORDER', 8, 'HB', 0.45);
  y += 15;

  p.text(M, y, addr.recipientName, 10.5, 'HB');
  p.text(M + 268, y, inv.order.orderNumber, 10.5, 'HB');
  y += 14;

  p.text(M, y, addr.recipientMobile, 9, 'H', 0.3);
  p.text(M + 268, y, `Placed  ${dateLabel(inv.order.placedAt)}`, 9, 'H', 0.3);
  y += 13;

  const line1 = [addr.house, addr.street].filter(Boolean).join(', ');
  const line2 = [addr.landmark, addr.city, addr.pincode].filter(Boolean).join(', ');
  p.text(M, y, fit(line1, 250, 9), 9, 'H', 0.3);
  if (inv.order.deliveredAt) {
    p.text(M + 268, y, `Delivered  ${dateLabel(inv.order.deliveredAt)}`, 9, 'H', 0.3);
  }
  y += 12;
  p.text(M, y, fit(line2, 250, 9), 9, 'H', 0.3);
  p.text(M + 268, y, `Payment  ${inv.order.paymentMethod}  ${'·'}  ${inv.paymentStatus}`, 9, 'H', 0.3);
  y += 12;

  // ── line-item table ──────────────────────────────────────────────────
  y += 18;
  const COL = { item: M, qty: M + 250, rate: M + 330, tax: M + 410, amount: RIGHT };
  p.rect(M - 8, y - 11, PAGE.w - 2 * M + 16, 22, 0.93);
  p.text(COL.item, y + 4, 'ITEM', 8.5, 'HB', 0.25);
  p.text(COL.qty, y + 4, 'QTY', 8.5, 'HB', 0.25);
  p.textRight(COL.rate + 46, y + 4, 'RATE', 8.5, 'HB', 0.25);
  p.textRight(COL.tax + 44, y + 4, 'TAX', 8.5, 'HB', 0.25);
  p.textRight(COL.amount, y + 4, 'AMOUNT', 8.5, 'HB', 0.25);
  y += 26;

  for (const it of inv.items) {
    p.text(COL.item, y, fit(it.nameSnapshot, 236, 9.5), 9.5);
    p.text(COL.qty, y, qtyLabel(Number(it.qty), it.unitSnapshot), 9.5, 'H', 0.25);
    p.textRight(COL.rate + 46, y, plain(it.unitPricePaise), 9.5, 'H', 0.25);
    p.textRight(COL.tax + 44, y, it.taxPaise > 0 ? plain(it.taxPaise) : '-', 9.5, 'H', 0.25);
    p.textRight(COL.amount, y, plain(it.lineTotalPaise), 9.5, 'HB');

    if (it.skuSnapshot) {
      y += 11;
      p.text(COL.item, y, it.skuSnapshot, 7.5, 'H', 0.55);
    }
    y += 9;
    p.line(M - 8, y, RIGHT + 8, y, 0.9, 0.5);
    y += 15;
  }

  // ── totals ───────────────────────────────────────────────────────────
  const labelX = COL.rate + 46;
  const row = (label: string, value: string, bold = false) => {
    p.textRight(labelX, y, label, bold ? 10 : 9.5, bold ? 'HB' : 'H', bold ? 0 : 0.3);
    p.textRight(COL.amount, y, value, bold ? 11 : 9.5, bold ? 'HB' : 'H', 0);
    y += bold ? 18 : 15;
  };

  y += 6;
  row('Taxable value', plain(inv.subtotalPaise));
  if (inv.discountPaise > 0) row('Discount', `- ${plain(inv.discountPaise)}`);
  if (inv.taxPaise > 0) row('GST', plain(inv.taxPaise));
  row('Delivery fee', inv.deliveryFeePaise > 0 ? plain(inv.deliveryFeePaise) : 'Free');

  p.line(labelX - 120, y - 4, RIGHT, y - 4, 0.55, 0.9);
  y += 8;
  row('TOTAL', money(inv.totalPaise), true);

  if (inv.paidPaise > 0) {
    row(inv.order.paymentMethod === 'COD' ? 'Cash collected' : 'Paid', plain(inv.paidPaise));
  }
  const due = inv.totalPaise - inv.paidPaise;
  if (due > 0) row('Balance due', plain(due), true);

  // ── footer ───────────────────────────────────────────────────────────
  const footY = PAGE.h - 76;
  p.line(M, footY - 16, RIGHT, footY - 16, 0.85, 0.6);
  p.text(
    M,
    footY,
    inv.taxPaise > 0
      ? 'Prices are inclusive of GST. Tax shown above is the amount contained in the item prices.'
      : 'No GST charged on this invoice.',
    8,
    'H',
    0.45,
  );
  p.text(M, footY + 13, 'This is a computer-generated invoice and does not require a signature.', 8, 'H', 0.45);
  p.textRight(RIGHT, footY + 13, `${inv.invoiceNo}  ·  Page 1 of 1`, 8, 'H', 0.45);

  return p.build(`Invoice ${inv.invoiceNo}`);
}
