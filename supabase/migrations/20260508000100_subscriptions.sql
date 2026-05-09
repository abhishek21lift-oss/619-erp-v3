-- ════════════════════════════════════════════════════════════════════
-- Subscriptions table — proper history for member packages
-- ════════════════════════════════════════════════════════════════════
-- Run once on Supabase / Postgres:
--   psql "$DATABASE_URL" -f db/migrations/2026-05-subscriptions.sql
--
-- Per ARCHITECTURE-BLUEPRINT.md §2.8.
--
-- Why this exists
-- ---------------
-- The current model conflates "the member's CURRENT package"
-- (clients.package_type, clients.pt_end_date) with "the HISTORY of
-- packages". That's why renewals overwrite the previous package without a
-- trace and the Add Subscription form had no proper audit trail.
--
-- This migration introduces a `subscriptions` table that is the source of
-- truth going forward. The legacy denormalised columns on `clients` stay
-- in place and are kept in sync by the service layer for backward compat
-- with existing list / detail screens.
--
-- Note on types: clients.id is TEXT (gen_random_uuid()::TEXT), not UUID,
-- so client_id and parent_id are TEXT to satisfy the FK.

CREATE TABLE IF NOT EXISTS subscriptions (
  id               TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id        TEXT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id          TEXT          REFERENCES plans(id),
  -- Snapshot the plan name at sale time so renaming the plan later does not
  -- rewrite history.
  plan_name        TEXT          NOT NULL,
  -- Optional multi-branch attribution. Branch-aware reporting is built on
  -- top of this column; see blueprint §2.13.
  branch_id        TEXT,
  start_date       DATE          NOT NULL,
  end_date         DATE          NOT NULL,
  base_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  signup_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_percent      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Net of discount + GST + signup fee. The single number that should
  -- match the receipt total and the payment row amount.
  final_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method   TEXT          NOT NULL DEFAULT 'CASH',
  receipt_no       TEXT,
  invoice_url      TEXT,
  coupon_code      TEXT,
  -- For family / corporate plans where multiple subs share a "group".
  group_id         TEXT,
  status           TEXT          NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','frozen','expired','cancelled','superseded')),
  freeze_days_used INTEGER       NOT NULL DEFAULT 0,
  freeze_days_max  INTEGER       NOT NULL DEFAULT 0,
  auto_renew       BOOLEAN       NOT NULL DEFAULT FALSE,
  -- Renewal chain: a renewal points back to the sub it replaces.
  parent_id        TEXT          REFERENCES subscriptions(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  cancelled_at     TIMESTAMPTZ,
  cancelled_reason TEXT
);

-- ── Indexes ─────────────────────────────────────────────────────────
-- The most common query: "what is this member's active subscription?"
CREATE INDEX IF NOT EXISTS idx_subs_client_active
  ON subscriptions (client_id, end_date DESC)
  WHERE status = 'active';

-- Branch-scoped period reports (Finance > Collection, Insights > Footfall).
CREATE INDEX IF NOT EXISTS idx_subs_branch_period
  ON subscriptions (branch_id, start_date, end_date);

-- "Expiring soon" worker scans this every morning.
CREATE INDEX IF NOT EXISTS idx_subs_expiring
  ON subscriptions (end_date)
  WHERE status = 'active';

-- Renewal chain traversal.
CREATE INDEX IF NOT EXISTS idx_subs_parent
  ON subscriptions (parent_id)
  WHERE parent_id IS NOT NULL;

-- ── updated_at trigger ──────────────────────────────────────────────
-- Keep updated_at fresh without callers needing to remember it. Reuses
-- the same set_updated_at() function the project uses elsewhere if it
-- already exists; otherwise creates a local one.
CREATE OR REPLACE FUNCTION set_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_subscriptions_updated_at();

-- ── Backfill (optional) ─────────────────────────────────────────────
-- Seed one row per existing member's current package so reports are not
-- empty on day 1. Safe to run multiple times — the WHERE clause excludes
-- members already represented in `subscriptions`.
INSERT INTO subscriptions
  (id, client_id, plan_name, start_date, end_date,
   base_amount, discount_amount, final_amount, paid_amount,
   payment_method, status, created_at)
SELECT
  gen_random_uuid()::TEXT,
  c.id,
  COALESCE(c.package_type, 'Legacy Plan'),
  COALESCE(c.pt_start_date, c.joining_date, CURRENT_DATE),
  COALESCE(c.pt_end_date,   COALESCE(c.pt_start_date, CURRENT_DATE) + INTERVAL '1 month'),
  COALESCE(c.base_amount,   0),
  COALESCE(c.discount,      0),
  COALESCE(c.final_amount,  0),
  COALESCE(c.paid_amount,   0),
  COALESCE(c.payment_method,'CASH'),
  CASE
    WHEN c.status = 'frozen'  THEN 'frozen'
    WHEN c.status = 'expired' THEN 'expired'
    ELSE 'active'
  END,
  COALESCE(c.joining_date, NOW())
FROM clients c
WHERE c.package_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.client_id = c.id
  );

-- ── Phase-2 additions (idempotent) ──────────────────────────────────
-- Columns and view added after the original migration. Each ALTER /
-- CREATE is guarded so re-running the migration is safe.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trainer_id    TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS freeze_from   DATE,
  ADD COLUMN IF NOT EXISTS freeze_until  DATE,
  ADD COLUMN IF NOT EXISTS performed_by  TEXT;

-- "Members whose subscription auto-renews tomorrow" — used by the
-- renewal worker to charge saved payment methods on T-1.
CREATE INDEX IF NOT EXISTS idx_subs_auto_renew
  ON subscriptions (end_date)
  WHERE status = 'active' AND auto_renew = TRUE;

-- A flat view of each member's current active sub. Member profile uses
-- this instead of the legacy denorm columns once we migrate read paths.
CREATE OR REPLACE VIEW v_active_subscription AS
SELECT DISTINCT ON (client_id) *
FROM subscriptions
WHERE status = 'active'
ORDER BY client_id, end_date DESC;

-- ── Quick smoke test ────────────────────────────────────────────────
-- After running, verify with:
--   SELECT COUNT(*) FROM subscriptions;
--   SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 5;
--   SELECT * FROM v_active_subscription LIMIT 5;
