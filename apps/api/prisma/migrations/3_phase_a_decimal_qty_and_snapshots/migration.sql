-- Phase A — client spec alignment.
--
-- HAND-WRITTEN, not `migrate diff` output: the generator wants to drop
-- Product_searchVector_idx and Product_name_trgm_idx (raw-SQL GIN indexes from
-- migration 1 that Prisma reads as drift). Applying its version would silently
-- disable product search. Same trap as migration 2.
--
-- 1. Quantities become DECIMAL(12,3) — spec 2.2. Groceries sell by weight;
--    integers made 0.5 kg of tomatoes literally unrepresentable.
-- 2. order_addresses snapshot — spec 5.3.
-- 3. Standard columns + version_no — spec 2.1.

-- ── 1. record status enum ──────────────────────────────────────────────
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- ── 2. decimal quantities ──────────────────────────────────────────────
-- USING casts keep existing integer values intact (5 -> 5.000).
ALTER TABLE "Product"
  ALTER COLUMN "stockQty"    TYPE DECIMAL(12,3) USING "stockQty"::DECIMAL(12,3),
  ALTER COLUMN "stockQty"    SET DEFAULT 0,
  ALTER COLUMN "reservedQty" TYPE DECIMAL(12,3) USING "reservedQty"::DECIMAL(12,3),
  ALTER COLUMN "reservedQty" SET DEFAULT 0,
  ALTER COLUMN "lowStockAt"  TYPE DECIMAL(12,3) USING "lowStockAt"::DECIMAL(12,3),
  ALTER COLUMN "lowStockAt"  SET DEFAULT 5;

ALTER TABLE "Product"
  ADD COLUMN "stepQty" DECIMAL(12,3) NOT NULL DEFAULT 1,
  ADD COLUMN "minQty"  DECIMAL(12,3) NOT NULL DEFAULT 1;

-- Loose goods step in halves; packaged goods stay whole.
UPDATE "Product" SET "stepQty" = 0.5, "minQty" = 0.5 WHERE "unit" IN ('KG', 'LITRE');

ALTER TABLE "CartItem"
  ALTER COLUMN "qty" TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3);

ALTER TABLE "StockLedger"
  ALTER COLUMN "delta" TYPE DECIMAL(12,3) USING "delta"::DECIMAL(12,3);

ALTER TABLE "OrderItem"
  ALTER COLUMN "qty" TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3),
  ADD COLUMN "confirmedQty" DECIMAL(12,3),
  ADD COLUMN "fulfilledQty" DECIMAL(12,3);

-- ── 3. order address snapshot (spec 5.3) ───────────────────────────────
CREATE TABLE "OrderAddress" (
    "id"              TEXT NOT NULL,
    "orderId"         TEXT NOT NULL,
    "sourceAddressId" TEXT,
    "recipientName"   TEXT,
    "recipientMobile" TEXT,
    "house"           TEXT NOT NULL,
    "street"          TEXT NOT NULL,
    "landmark"        TEXT,
    "locality"        TEXT,
    "city"            TEXT NOT NULL,
    "district"        TEXT,
    "state"           TEXT,
    "pincode"         TEXT NOT NULL,
    "lat"             DOUBLE PRECISION NOT NULL,
    "lng"             DOUBLE PRECISION NOT NULL,
    "instructions"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderAddress_orderId_key" ON "OrderAddress"("orderId");

ALTER TABLE "OrderAddress"
  ADD CONSTRAINT "OrderAddress_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill from the live address so existing orders are not left without a
-- snapshot. Values are current-as-of-now, which is the best available truth.
INSERT INTO "OrderAddress" (
  "id","orderId","sourceAddressId","recipientName","recipientMobile",
  "house","street","landmark","city","pincode","lat","lng","instructions"
)
SELECT
  gen_random_uuid()::text, o."id", a."id", u."name", u."phone",
  a."house", a."street", a."landmark", a."city", a."pincode",
  a."lat", a."lng", a."instructions"
FROM "Order" o
JOIN "Address" a ON a."id" = o."addressId"
JOIN "User"    u ON u."id" = o."userId"
ON CONFLICT ("orderId") DO NOTHING;

-- ── 4. standard columns (spec 2.1) ─────────────────────────────────────
ALTER TABLE "Order"
  ADD COLUMN "versionNo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "cancellationReasonCode" TEXT;

ALTER TABLE "Product"
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "updatedBy" TEXT,
  ADD COLUMN "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "versionNo" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Store"
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "updatedBy" TEXT,
  ADD COLUMN "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "versionNo" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Driver"
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "updatedBy" TEXT,
  ADD COLUMN "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "versionNo" INTEGER NOT NULL DEFAULT 0;

-- Soft-deleted catalogue rows carry the matching record status.
UPDATE "Product" SET "recordStatus" = 'DELETED' WHERE "deletedAt" IS NOT NULL;
