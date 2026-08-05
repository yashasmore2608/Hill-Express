-- Stage 14: invoices and payment reconciliation (spec §11).
--
-- HAND-WRITTEN, like migrations 2 and 3. `prisma migrate diff` does not know
-- about the tsvector column or the GIN/trgm indexes on "Product" — they were
-- created in raw SQL — so it emits DROP INDEX for both every time. Writing
-- the migration by hand is the only way they survive.

-- ── 1. enums ──────────────────────────────────────────────────────────
CREATE TYPE "InvoiceType" AS ENUM ('TAX_INVOICE', 'CREDIT_NOTE');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- ── 2. financial-year serial counter ──────────────────────────────────
-- GST rule 46(b): consecutive serial, unique within a financial year.
CREATE TABLE "InvoiceSeq" (
    "fy"  TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceSeq_pkey" PRIMARY KEY ("fy")
);

-- ── 3. invoices ───────────────────────────────────────────────────────
CREATE TABLE "Invoice" (
    "id"               TEXT NOT NULL,
    "invoiceNo"        TEXT NOT NULL,
    "orderId"          TEXT NOT NULL,
    "storeId"          TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "type"             "InvoiceType" NOT NULL DEFAULT 'TAX_INVOICE',
    "status"           "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "subtotalPaise"    INTEGER NOT NULL,
    "discountPaise"    INTEGER NOT NULL DEFAULT 0,
    "taxPaise"         INTEGER NOT NULL DEFAULT 0,
    "deliveryFeePaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise"       INTEGER NOT NULL,
    "paymentStatus"    "InvoicePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidPaise"        INTEGER NOT NULL DEFAULT 0,
    "documentUrl"      TEXT,
    "invoiceDate"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt"         TIMESTAMP(3),
    "cancelledAt"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "createdBy"        TEXT,
    "updatedBy"        TEXT,
    "recordStatus"     "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "versionNo"        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- One invoice per order. This unique constraint IS the idempotency guard —
-- a retried issue call cannot burn a second serial on the same order.
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");
CREATE UNIQUE INDEX "Invoice_orderId_key"   ON "Invoice"("orderId");
CREATE INDEX "Invoice_storeId_invoiceDate_idx" ON "Invoice"("storeId", "invoiceDate" DESC);
CREATE INDEX "Invoice_userId_invoiceDate_idx"  ON "Invoice"("userId", "invoiceDate" DESC);
CREATE INDEX "Invoice_paymentStatus_idx"       ON "Invoice"("paymentStatus");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Invoice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Invoice_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. invoice lines ──────────────────────────────────────────────────
CREATE TABLE "InvoiceItem" (
    "id"             TEXT NOT NULL,
    "invoiceId"      TEXT NOT NULL,
    "orderItemId"    TEXT NOT NULL,
    "nameSnapshot"   TEXT NOT NULL,
    "skuSnapshot"    TEXT,
    "unitSnapshot"   "Unit" NOT NULL,
    "qty"            DECIMAL(12,3) NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "discountPaise"  INTEGER NOT NULL DEFAULT 0,
    "taxBps"         INTEGER NOT NULL DEFAULT 0,
    "taxPaise"       INTEGER NOT NULL DEFAULT 0,
    "lineTotalPaise" INTEGER NOT NULL,
    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"   FOREIGN KEY ("invoiceId")   REFERENCES "Invoice"("id")   ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoiceItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
