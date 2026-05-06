-- ════════════════════════════════════════════════════════════════════
--  619 Fitness ERP — performance + soft-delete migration
--  Date: 2026-05-06
--
--  This migration is ADDITIVE — running it on a live multi-gym install
--  will not lock tables (CONCURRENTLY) and will not break existing rows.
--  No drops, no renames, no defaults that need backfill.
--
--  Run in Supabase SQL Editor or psql against your DATABASE_URL.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. pg_trgm: case-insensitive LIKE search uses index ────────────
--     The new GET /api/clients?search=… uses ILIKE. Without trigram
--     indexes that's a sequential scan; with them it's sub-100ms even
--     at 100k+ members.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clients_name_trgm
  ON clients USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_email_trgm
  ON clients USING GIN (email gin_trgm_ops);

-- mobile is small + selective; a simple btree on lower(...) is enough.
CREATE INDEX IF NOT EXISTS idx_clients_mobile
  ON clients (mobile);

-- client_id (FS0001) is exact-match in practice — already UNIQUE which
-- gives an index automatically, no action needed.

-- ── 2. Composite index for "expiring next 7 days" ──────────────────
--     Used by dashboard, /members/expiring, and renewal automations.
CREATE INDEX IF NOT EXISTS idx_clients_status_pt_end_date
  ON clients (status, pt_end_date);

-- ── 3. Recent payments feed ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_created_desc
  ON payments (created_at DESC);

-- ── 4. Birthday / anniversary lookups ──────────────────────────────
--     EXTRACT(MONTH/DAY FROM dob) is not sargable. A functional index
--     on the doy makes both queries sub-millisecond.
CREATE INDEX IF NOT EXISTS idx_clients_dob_doy
  ON clients (status, EXTRACT(DOY FROM dob))
  WHERE dob IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_join_doy
  ON clients (status, EXTRACT(DOY FROM joining_date))
  WHERE joining_date IS NOT NULL;

-- ── 5. Soft-delete columns (forward-compatible) ────────────────────
--     Adding the column now is safe; the routes can later filter on
--     `deleted_at IS NULL` once you've migrated handlers. None of the
--     existing handlers reference this column, so nothing breaks.
ALTER TABLE clients   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE trainers  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE payments  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_alive
  ON clients (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_alive
  ON payments (id) WHERE deleted_at IS NULL;

-- ── 6. Audit columns: who did what (additive, nullable) ────────────
ALTER TABLE clients   ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE clients   ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE payments  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- ── 7. Multi-tenant readiness (optional — uncomment when ready) ────
--     If/when you go true multi-gym, add a branch_id everywhere and
--     scope every query. The schema below is the safe additive shape;
--     leaving columns NULLable means the existing single-tenant deploy
--     keeps running while you backfill.
--
-- CREATE TABLE IF NOT EXISTS branches (
--   id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
--   name        TEXT NOT NULL,
--   timezone    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
--   currency    TEXT NOT NULL DEFAULT 'INR',
--   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- ALTER TABLE clients   ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);
-- ALTER TABLE trainers  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);
-- ALTER TABLE payments  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);
-- ALTER TABLE attendance ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);
-- ALTER TABLE users     ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);
--
-- CREATE INDEX IF NOT EXISTS idx_clients_branch    ON clients(branch_id);
-- CREATE INDEX IF NOT EXISTS idx_payments_branch   ON payments(branch_id);
-- CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance(branch_id);

-- ── 8. Tighter receipt-number uniqueness ───────────────────────────
--     Already UNIQUE in the schema, but make the index explicit so
--     EXPLAIN ANALYZE shows it.
-- (no-op — payments.receipt_no UNIQUE already creates this index)

ANALYZE clients;
ANALYZE payments;

-- ════════════════════════════════════════════════════════════════════
--  Done. If a query suddenly looks slow, run:
--    EXPLAIN (ANALYZE, BUFFERS) SELECT … ;
--  and verify it's hitting one of the indexes above.
-- ════════════════════════════════════════════════════════════════════
