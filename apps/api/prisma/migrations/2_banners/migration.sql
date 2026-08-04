-- Promo banners for the customer home carousel.
--
-- Hand-written, NOT `migrate diff` output: the generated diff wanted to drop
-- Product_searchVector_idx and Product_name_trgm_idx, because those GIN indexes
-- were created in raw SQL (migration 1) and Prisma reads them as drift.
-- Applying its version would silently disable product search.

CREATE TYPE "BannerLinkType" AS ENUM ('NONE', 'CATEGORY', 'PRODUCT', 'SEARCH');

CREATE TABLE "Banner" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT,
    "title"     TEXT NOT NULL,
    "subtitle"  TEXT,
    "imageUrl"  TEXT,
    "bgColor"   TEXT NOT NULL DEFAULT '#0B3D2E',
    "ctaLabel"  TEXT,
    "linkType"  "BannerLinkType" NOT NULL DEFAULT 'NONE',
    "linkValue" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "startsAt"  TIMESTAMP(3),
    "endsAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Banner_isActive_sortOrder_idx" ON "Banner"("isActive", "sortOrder");
CREATE INDEX "Banner_storeId_isActive_idx" ON "Banner"("storeId", "isActive");

ALTER TABLE "Banner"
  ADD CONSTRAINT "Banner_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
