-- FR-C-007: full-text product search with typo tolerance.
--
-- Two engines, one query:
--  1. tsvector + GIN     → word/phrase matches, ranked ("amul butter")
--  2. pg_trgm similarity → typo tolerance ("aata" still finds "Atta")
--
-- 'simple' config, not 'english': product names are brand nouns and
-- Hinglish — English stemming would mangle them, not help.
--
-- The column is GENERATED: it can never drift from name/packSize, and
-- writers don't even need to know it exists.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("packSize", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS "Product_searchVector_idx"
  ON "Product" USING GIN ("searchVector");

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops);
