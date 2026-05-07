-- ════════════════════════════════════════════════════════════════════
-- Branches & Kiosk devices (Blueprint §2.13, §3.6)
-- ════════════════════════════════════════════════════════════════════
-- Run once on Supabase / Postgres:
--   psql "$DATABASE_URL" -f db/migrations/2026-05-branches-and-kiosks.sql
--
-- ADDITIVE. Existing single-branch deployments keep working with NULL
-- branch_id everywhere. The "default branch" row is seeded on first run.

-- 1) Branches (gym locations).
CREATE TABLE IF NOT EXISTS branches (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name            TEXT NOT NULL,
  code            TEXT UNIQUE,                       -- short slug, e.g. '619-MAIN'
  address         TEXT,
  city            TEXT,
  state           TEXT,
  pincode         TEXT,
  country         TEXT DEFAULT 'IN',
  phone           TEXT,
  email           TEXT,
  gst_no          TEXT,
  pan_no          TEXT,
  invoice_prefix  TEXT,                              -- e.g. '619-2026-' for receipt_no
  open_time       TIME DEFAULT '06:00',
  close_time      TIME DEFAULT '23:00',
  timezone        TEXT DEFAULT 'Asia/Kolkata',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_active ON branches (is_active) WHERE is_active;

-- Seed a default branch so existing single-branch installs have a row to
-- attach to. Idempotent.
INSERT INTO branches (id, name, code, invoice_prefix, is_active)
VALUES ('branch-default', '619 Fitness Studio', '619-MAIN', '619-', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2) Add branch_id to clients / users / trainers / payments (nullable).
ALTER TABLE clients   ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE trainers  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE payments  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    EXECUTE 'ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_clients_branch  ON clients  (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trainers_branch ON trainers (branch_id) WHERE branch_id IS NOT NULL;

-- 3) Kiosk devices — wall-mounted iPads / mini-PCs running the check-in
-- page. Each device has a long-lived bearer token scoped to ONE branch
-- and to /api/checkin/face only. Avoids putting a staff JWT on a kiosk.
CREATE TABLE IF NOT EXISTS kiosk_devices (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  branch_id     TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                       -- "Front Desk Kiosk", "Studio B Tablet"
  -- SHA-256 of the issued bearer token. We never store the plaintext.
  token_hash    TEXT NOT NULL UNIQUE,
  token_prefix  TEXT NOT NULL,                       -- first 8 chars, shown in the admin UI for ID
  last_seen_at  TIMESTAMPTZ,
  last_seen_ip  TEXT,
  user_agent    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kiosk_devices_branch_active
  ON kiosk_devices (branch_id) WHERE is_active = TRUE;

-- 4) Membership-actions log — already exists (membership_actions) but
-- needs a branch_id for cross-branch reporting. Additive.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'membership_actions') THEN
    EXECUTE 'ALTER TABLE membership_actions
               ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_member_actions_branch
               ON membership_actions (branch_id, action_date DESC)';
  END IF;
END$$;

-- ────────────────────────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────────────────────────
--   SELECT id, name, code FROM branches;
--   SELECT name, branch_id, last_seen_at FROM kiosk_devices WHERE is_active;
