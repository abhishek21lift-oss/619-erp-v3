-- ═══════════════════════════════════════════════════════════════════════
--  619 FITNESS STUDIO ERP — Database Migration v3
--  Run this in Supabase SQL Editor to bring schema in sync with frontend v3.
--  Safe to run on existing database (uses IF NOT EXISTS + IF NOT EXISTS cols).
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. CLIENTS TABLE — add missing columns ──────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS member_code       TEXT,
  ADD COLUMN IF NOT EXISTS freeze_from       DATE,
  ADD COLUMN IF NOT EXISTS freeze_until      DATE,
  ADD COLUMN IF NOT EXISTS freeze_reason     TEXT,
  ADD COLUMN IF NOT EXISTS is_frozen         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS secondary_trainer_id   TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secondary_trainer_name TEXT,
  ADD COLUMN IF NOT EXISTS pt_sessions_total      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pt_sessions_used       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combo_plan             TEXT,
  ADD COLUMN IF NOT EXISTS source                 TEXT DEFAULT 'walk-in',
  ADD COLUMN IF NOT EXISTS emergency_contact      TEXT,
  ADD COLUMN IF NOT EXISTS blood_group            TEXT,
  ADD COLUMN IF NOT EXISTS height                 NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS goal                   TEXT;

-- Backfill member_code from client_id for existing rows
UPDATE clients SET member_code = client_id WHERE member_code IS NULL;

-- Update status CHECK to include 'frozen'
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active','expired','frozen','inactive','trial'));

-- ── 2. PLANS TABLE — extend, do NOT drop ────────────────────────────────
--
-- The previous version of this migration ran `DROP TABLE plans CASCADE`,
-- which (a) destroys every existing plan and any FK-dependent rows on a
-- live install and (b) violates the README's "additive only" promise.
--
-- Instead we ADD the new v3 columns to the existing plans table. The
-- legacy `duration INTEGER` column stays in place so old code keeps
-- working; new code uses `duration_label` for the v3 string buckets.
CREATE TABLE IF NOT EXISTS plans (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name             TEXT NOT NULL,
  duration         INTEGER,
  price            NUMERIC(10,2),
  description      TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS kind             TEXT NOT NULL DEFAULT 'Membership',
  ADD COLUMN IF NOT EXISTS duration_label   TEXT NOT NULL DEFAULT 'Monthly',
  ADD COLUMN IF NOT EXISTS base_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_per_week INTEGER,
  ADD COLUMN IF NOT EXISTS features         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS popular          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gym_id           TEXT,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_kind_check;
ALTER TABLE plans ADD  CONSTRAINT plans_kind_check
  CHECK (kind IN ('Membership','PT'));

ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_duration_label_check;
ALTER TABLE plans ADD  CONSTRAINT plans_duration_label_check
  CHECK (duration_label IN ('Monthly','Quarterly','Half Yearly','Yearly'));

-- Seed default plans (uses duration_label for v3 string buckets;
-- duration is left NULL for the v3 rows because the legacy column is INTEGER days).
INSERT INTO plans (id, kind, name, duration_label, base_amount, discount, final_amount, sessions_per_week, features, popular) VALUES
  ('plan-m-1', 'Membership', 'Monthly Membership',     'Monthly',     2500,  0,    2500,  NULL, '["Full gym access","Locker facility","Free trial class"]', FALSE),
  ('plan-m-2', 'Membership', 'Quarterly Membership',   'Quarterly',   7000,  500,  6500,  NULL, '["Full gym access","Locker","1 Body composition test","Free diet consult"]', TRUE),
  ('plan-m-3', 'Membership', 'Half-Yearly Membership', 'Half Yearly', 13000, 1500, 11500, NULL, '["Full gym access","Locker","Body comp test","Diet consult","Group class access"]', FALSE),
  ('plan-m-4', 'Membership', 'Annual Membership',      'Yearly',      24000, 4000, 20000, NULL, '["Full gym access","Personal locker","Quarterly body comp tests","Diet plan","All group classes"]', FALSE),
  ('plan-pt-1','PT',         'PT Monthly',             'Monthly',     6000,  0,    6000,  3,    '["12 PT sessions/month","Personalised workout plan","Form & technique correction"]', FALSE),
  ('plan-pt-2','PT',         'PT Quarterly',           'Quarterly',   16500, 1500, 15000, 3,    '["36 PT sessions","Personalised plan","Diet consultation","Progress photos"]', TRUE),
  ('plan-pt-3','PT',         'PT Half-Yearly',         'Half Yearly', 30000, 4000, 26000, 3,    '["72 PT sessions","Custom workout plan","Detailed diet plan","Body comp tests"]', FALSE),
  ('plan-pt-4','PT',         'PT Annual',              'Yearly',      55000, 10000,45000, 3,    '["144+ PT sessions","Premium plan & diet","Quarterly body comp tests","Priority slot booking"]', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── 3. MEMBERSHIP ACTIONS TABLE — log all membership events ─────────────
CREATE TABLE IF NOT EXISTS membership_actions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
  client_name     TEXT,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL
                    CHECK (action_type IN (
                      'freeze','extension','downgrade','transfer',
                      'upgrade','combo','trial','assign_pt',
                      'add_subscription','renew_subscription','renew_pt'
                    )),
  old_value       JSONB,
  new_value       JSONB,
  amount          NUMERIC(10,2) DEFAULT 0,
  payment_method  TEXT DEFAULT 'CASH',
  notes           TEXT,
  performed_by    TEXT,
  action_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_actions_client ON membership_actions(client_id);
CREATE INDEX IF NOT EXISTS idx_membership_actions_date   ON membership_actions(action_date);
CREATE INDEX IF NOT EXISTS idx_membership_actions_type   ON membership_actions(action_type);

-- ── 4. TRIALS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trials (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
  client_name     TEXT,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  trainer_name    TEXT,
  trial_date      DATE NOT NULL,
  time_slot       TEXT,
  focus_area      TEXT,
  notes           TEXT,
  status          TEXT DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trials_date ON trials(trial_date);

-- ── 5. ENQUIRIES / LEADS TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name            TEXT NOT NULL,
  mobile          TEXT,
  email           TEXT,
  source          TEXT DEFAULT 'walk-in',
  interest        TEXT,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  follow_up_date  DATE,
  status          TEXT DEFAULT 'new'
                    CHECK (status IN ('new','contacted','interested','converted','lost')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status     ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_followup   ON enquiries(follow_up_date);

-- ── 6. RENEWALS TABLE — add missing columns ──────────────────────────────
ALTER TABLE renewals
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'renewal',
  ADD COLUMN IF NOT EXISTS discount    NUMERIC(10,2) DEFAULT 0;

-- ── 7. PAYMENTS TABLE — add missing columns ──────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS transaction_ref TEXT,
  ADD COLUMN IF NOT EXISTS collected_by    TEXT;

-- ── 8. SETTINGS — add gym configuration keys ─────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('gym_name',           '619 FITNESS STUDIO'),
  ('gym_tagline',        'Premium Strength Studio'),
  ('gym_phone',          '+91-XXXXXXXXXX'),
  ('gym_address',        'Your Gym Address Here'),
  ('currency',           'INR'),
  ('gst_percent',        '0'),
  ('incentive_threshold','50000'),
  ('incentive_rate_high','50'),
  ('incentive_rate_low', '40'),
  ('timezone',           'Asia/Kolkata'),
  ('date_format',        'DD-MM-YYYY')
ON CONFLICT (key) DO NOTHING;

-- ── 9. USEFUL VIEWS ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_active_members AS
  SELECT c.*, t.name AS trainer_full_name
  FROM clients c
  LEFT JOIN trainers t ON t.id = c.trainer_id
  WHERE c.status = 'active';

CREATE OR REPLACE VIEW v_expiring_soon AS
  SELECT c.*, t.name AS trainer_full_name,
    (c.pt_end_date - CURRENT_DATE) AS days_left
  FROM clients c
  LEFT JOIN trainers t ON t.id = c.trainer_id
  WHERE c.status = 'active'
    AND c.pt_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  ORDER BY c.pt_end_date;

CREATE OR REPLACE VIEW v_outstanding_dues AS
  SELECT c.id, c.client_id, c.name, c.mobile, c.package_type,
    c.balance_amount, c.pt_end_date, c.status,
    t.name AS trainer_name
  FROM clients c
  LEFT JOIN trainers t ON t.id = c.trainer_id
  WHERE c.balance_amount > 0
  ORDER BY c.balance_amount DESC;

CREATE OR REPLACE VIEW v_trainer_monthly_revenue AS
  SELECT
    t.id AS trainer_id, t.name AS trainer_name, t.incentive_rate,
    DATE_TRUNC('month', p.date::date) AS month,
    COUNT(DISTINCT p.client_id) AS clients_paid,
    SUM(p.amount) AS total_revenue,
    SUM(p.amount) * t.incentive_rate AS incentive_earned
  FROM trainers t
  JOIN payments p ON p.trainer_id = t.id
  GROUP BY t.id, t.name, t.incentive_rate, DATE_TRUNC('month', p.date::date)
  ORDER BY month DESC, total_revenue DESC;

-- ── 10. INDEXES for performance ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_mobile     ON clients(mobile);
CREATE INDEX IF NOT EXISTS idx_clients_member_code ON clients(member_code);
CREATE INDEX IF NOT EXISTS idx_clients_dob        ON clients(dob);
CREATE INDEX IF NOT EXISTS idx_plans_kind         ON plans(kind);
CREATE INDEX IF NOT EXISTS idx_plans_active       ON plans(is_active);

-- ── DONE ─────────────────────────────────────────────────────────────────
-- Run node src/db/seed.js to re-seed demo users after this migration.
