-- ════════════════════════════════════════════════════════════════════
-- Plans v4 — modern SaaS-gym extensions (Blueprint §4.2)
-- ════════════════════════════════════════════════════════════════════
-- Run once on Supabase / Postgres:
--   psql "$DATABASE_URL" -f db/migrations/2026-05-plans-v4.sql
--
-- ADDITIVE only. Existing `plans` rows continue to work; new columns are
-- nullable / have defaults so legacy code that doesn't set them still
-- compiles. The frontend Plans wizard reads the new columns when present.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS description           TEXT,
  ADD COLUMN IF NOT EXISTS category              TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS freeze_days_max       INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_unit           TEXT     DEFAULT 'Days'
                                                 CHECK (freeze_unit IN ('Days','Weeks','Months')),
  ADD COLUMN IF NOT EXISTS auto_renew            BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_days            INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signup_fee            NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pt_sessions_included  INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diet_consult_included BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pause_rules           JSONB    DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS gst_percent           NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_ids            TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_slots            JSONB    DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS session_limit_per_day INTEGER,
  ADD COLUMN IF NOT EXISTS session_limit_total   INTEGER,
  ADD COLUMN IF NOT EXISTS qr_access             BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS biometric_access      BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS guest_passes          INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_reward_pct   NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_pct          NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_upgrade         BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_downgrade       BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plan_type             TEXT     DEFAULT 'individual'
                                                 CHECK (plan_type IN ('individual','family','corporate','student','senior','hybrid','trial')),
  ADD COLUMN IF NOT EXISTS family_members_max    INTEGER  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS corporate_company     TEXT,
  ADD COLUMN IF NOT EXISTS corporate_min_seats   INTEGER,
  ADD COLUMN IF NOT EXISTS corporate_discount_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS hybrid_online_pct     INTEGER,
  ADD COLUMN IF NOT EXISTS template_of           TEXT REFERENCES plans(id),
  ADD COLUMN IF NOT EXISTS valid_from            DATE,
  ADD COLUMN IF NOT EXISTS valid_until           DATE,
  ADD COLUMN IF NOT EXISTS sort_order            INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at           TIMESTAMPTZ;

-- Filter "active and currently sellable" plans without a sequential scan
CREATE INDEX IF NOT EXISTS idx_plans_active_sortable
  ON plans (kind, sort_order, final_amount)
  WHERE is_active = TRUE AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_plans_plan_type
  ON plans (plan_type)
  WHERE is_active = TRUE;

-- ────────────────────────────────────────────────────────────────────
-- Plan analytics rollup table (Blueprint §4.7)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_metrics (
  plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  month             DATE NOT NULL,
  subs_created      INTEGER NOT NULL DEFAULT 0,
  subs_renewed      INTEGER NOT NULL DEFAULT 0,
  subs_cancelled    INTEGER NOT NULL DEFAULT 0,
  revenue_gross     NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue_net       NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_lifetime_days INTEGER,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, month)
);

CREATE INDEX IF NOT EXISTS idx_plan_metrics_month
  ON plan_metrics (month DESC);

-- ────────────────────────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────────────────────────
--   SELECT name, plan_type, trial_days, gst_percent, signup_fee
--     FROM plans
--    ORDER BY sort_order, kind, final_amount
--    LIMIT 10;
