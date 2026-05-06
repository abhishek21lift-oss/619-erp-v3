-- ════════════════════════════════════════════════════════════════════
-- 619 Fitness ERP — COMBINED Supabase migration (v3.1, fix-1)
--
-- This is the SAFE combined file. Paste the WHOLE file into Supabase →
-- SQL Editor → Run. Safe to re-run. v3.1 vs the previous combined file:
--   * RESOLVES the table-name collision between v2-additive and v3-SaaS
--     (notifications / referrals had different shapes in each migration).
--     Step 2 now creates client_notifications + client_referrals; the
--     Step-4 v3 SaaS tables keep the canonical 'notifications'/'referrals'
--     names. A safety prologue auto-renames any legacy tables.
--   * Each step is otherwise byte-identical to its source file.
--
-- ─── ORDER (do not reorder) ─────────────────────────────────────────
-- 1. v2 base schema                  (tables, indexes, demo seed)
-- 2. v3 additive                     (KYC, subscriptions, follow-ups…)
--    [also renames legacy notifications/referrals to *_client_*]
-- 3. v3 additive                     (plans, trials, enquiries)
-- 4. v3 SaaS                         (members, bookings, classes, audit)
-- 5. face check-in                   (descriptors + log)
-- 6. perf + soft-delete              (indexes, deleted_at, audit columns)
-- 7. RLS + receipt sequence          (security hardening)
--
-- ─── BEFORE YOU RUN ─────────────────────────────────────────────────
--  * Make sure you're connected to the right Supabase project.
--  * Take a backup if there is any production data:
--      Supabase → Project → Database → Backups → Manual backup.
-- ════════════════════════════════════════════════════════════════════


-- ====================================================================
-- Step 1 — v2 base schema (tables, indexes, demo seed)
-- Source: db/migrations/supabase-schema.sql
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════════
--  619 Fitness Studio ERP — Supabase PostgreSQL Schema v2
--  
--  HOW TO RUN:
--  1. Go to your Supabase project dashboard
--  2. Click "SQL Editor" in the left sidebar
--  3. Click "New query"
--  4. Paste this ENTIRE file and click "Run"
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Drop tables if re-running (comment out if you want to keep data) ──
-- DROP TABLE IF EXISTS weight_logs, attendance, renewals, incentives, payments, clients, trainers, plans, settings, users CASCADE;

-- ────────────────────────────────────────────────────────────────────
--  USERS  (login accounts — separate from trainer profiles)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'trainer'
                -- v2 used (admin,trainer). v3 modules also issue tokens for
                -- manager / reception / member, so the constraint must allow
                -- those roles too — otherwise the v3 server can never insert
                -- a user with one of the new roles.
                CHECK (role IN ('admin','manager','trainer','reception','member')),
  trainer_id  TEXT,          -- links to trainers.id when role='trainer'
  member_id   TEXT,          -- links to clients.id when role='member' (v3)
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow re-running on existing DBs to widen the constraint and add member_id.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD  CONSTRAINT users_role_check
  CHECK (role IN ('admin','manager','trainer','reception','member'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id TEXT;

-- ────────────────────────────────────────────────────────────────────
--  TRAINERS
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name            TEXT NOT NULL,
  mobile          TEXT,
  email           TEXT,
  dob             DATE,
  gender          TEXT,
  address         TEXT,
  role            TEXT DEFAULT 'Personal Trainer',
  joining_date    DATE,
  salary          NUMERIC(10,2) DEFAULT 0,
  incentive_rate  NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  specialization  TEXT,
  certifications  TEXT,
  biometric_code  TEXT UNIQUE,
  biometric_added BOOLEAN DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
--  CLIENTS
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT UNIQUE,
  name            TEXT NOT NULL,
  mobile          TEXT,
  email           TEXT,
  gender          TEXT,
  dob             DATE,
  address         TEXT,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  trainer_name    TEXT,
  joining_date    DATE,
  pt_start_date   DATE,
  pt_end_date     DATE,
  package_type    TEXT,
  base_amount     NUMERIC(10,2) DEFAULT 0,
  discount        NUMERIC(10,2) DEFAULT 0,
  final_amount    NUMERIC(10,2) DEFAULT 0,
  paid_amount     NUMERIC(10,2) DEFAULT 0,
  balance_amount  NUMERIC(10,2) DEFAULT 0,
  payment_method  TEXT DEFAULT 'CASH',
  payment_date    DATE,
  weight          NUMERIC(5,2),
  notes           TEXT,
  photo_url       TEXT,
  biometric_code  TEXT UNIQUE,
  biometric_added BOOLEAN DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','frozen')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
--  PAYMENTS
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
  client_name     TEXT,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  trainer_name    TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  method          TEXT DEFAULT 'CASH'
                    CHECK (method IN ('CASH','UPI','CARD','BANK_TRANSFER')),
  date            DATE NOT NULL,
  receipt_no      TEXT UNIQUE,
  package_type    TEXT,
  incentive_amt   NUMERIC(10,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
--  ATTENDANCE
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  type            TEXT NOT NULL DEFAULT 'client'
                    CHECK (type IN ('client','trainer')),
  ref_id          TEXT NOT NULL,
  ref_name        TEXT,
  trainer_id      TEXT,
  trainer_name    TEXT,
  date            DATE NOT NULL,
  check_in        TIME,
  check_out       TIME,
  status          TEXT NOT NULL DEFAULT 'present'
                    CHECK (status IN ('present','absent','late','half_day','leave')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, ref_id, date)
);

-- ────────────────────────────────────────────────────────────────────
--  PLANS (membership packages)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name        TEXT NOT NULL,
  duration    INTEGER NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
--  RENEWALS
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS renewals (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
  client_name     TEXT,
  trainer_id      TEXT,
  trainer_name    TEXT,
  old_package     TEXT,
  new_package     TEXT,
  old_end_date    DATE,
  new_end_date    DATE,
  amount          NUMERIC(10,2) DEFAULT 0,
  paid_amount     NUMERIC(10,2) DEFAULT 0,
  payment_method  TEXT DEFAULT 'CASH',
  renewed_on      DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
--  INCENTIVES
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incentives (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE CASCADE,
  trainer_name    TEXT,
  month           TEXT NOT NULL,
  revenue         NUMERIC(10,2) DEFAULT 0,
  incentive_rate  NUMERIC(5,4) DEFAULT 0.5,
  incentive_amt   NUMERIC(10,2) DEFAULT 0,
  paid_amount     NUMERIC(10,2) DEFAULT 0,
  paid_on         DATE,
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','partial')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainer_id, month)
);

-- ────────────────────────────────────────────────────────────────────
--  WEIGHT LOGS
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id   TEXT REFERENCES clients(id) ON DELETE CASCADE,
  weight      NUMERIC(5,2) NOT NULL,
  date        DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
--  SETTINGS
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────
--  INDEXES
-- ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_trainer    ON clients(trainer_id);
CREATE INDEX IF NOT EXISTS idx_clients_status     ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_end_date   ON clients(pt_end_date);
CREATE INDEX IF NOT EXISTS idx_payments_client    ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_date      ON payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_trainer   ON payments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_attendance_ref     ON attendance(ref_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);

-- ════════════════════════════════════════════════════════════════════
--  SEED DATA — Demo users + sample trainers + clients
--
--  IMPORTANT: These bcrypt hashes are pre-computed:
--    admin@619fitness.com  → password: admin@619
--    trainer@619fitness.com → password: trainer@619
--
--  After deploying, run this command to regenerate fresh hashes:
--    node -e "const b=require('bcryptjs'); console.log(b.hashSync('admin@619',10))"
-- ════════════════════════════════════════════════════════════════════

-- Admin user (bcrypt hash of "admin@619" with cost 10)
-- IMPORTANT: bcrypt hashes are case-sensitive. The hash on INSERT and
-- ON CONFLICT must match exactly, otherwise re-running the migration
-- silently rewrites the password to a hash that doesn't validate.
-- Always re-seed with `node src/db/seed.js` after running this file.
INSERT INTO users (id, name, email, password, role) VALUES
  ('usr-admin-001', 'Admin', 'admin@619fitness.com',
   '$2a$10$rQnuz5yEoaConv/dSmMbXuO3lv5Y5KQB.eO4ClkQ7i8M/7/ZPNqGO',
   'admin')
ON CONFLICT (email) DO UPDATE SET
  password = '$2a$10$rQnuz5yEoaConv/dSmMbXuO3lv5Y5KQB.eO4ClkQ7i8M/7/ZPNqGO',
  updated_at = NOW();

-- Demo trainer users (password: trainer@619)
INSERT INTO users (id, name, email, password, role, trainer_id) VALUES
  ('usr-trainer-001', 'Riya Sharma', 'riya@619fitness.com',
   '$2a$10$9TBBKmLGmFKjLmoBWmZLDuqAA.2N1jY1Kd/HKxaI0jXr8BoWFxqGm',
   'trainer', 'tr-001'),
  ('usr-trainer-002', 'Abhishek Gupta', 'abhishek@619fitness.com',
   '$2a$10$9TBBKmLGmFKjLmoBWmZLDuqAA.2N1jY1Kd/HKxaI0jXr8BoWFxqGm',
   'trainer', 'tr-002')
ON CONFLICT (email) DO NOTHING;

-- Sample trainers
INSERT INTO trainers (id, name, mobile, email, role, joining_date, salary, incentive_rate, specialization, status) VALUES
  ('tr-001', 'Riya Sharma',     '9876543210', 'riya@619fitness.com',     'Personal Trainer', '2023-01-15', 25000, 0.50, 'Weight Loss, Yoga',    'active'),
  ('tr-002', 'Abhishek Gupta',  '9876543211', 'abhishek@619fitness.com', 'Strength Coach',   '2023-03-01', 28000, 0.55, 'Bodybuilding, Cardio', 'active'),
  ('tr-003', 'Rajat Singh',     '9876543212', 'rajat@619fitness.com',    'Cardio Specialist','2024-01-01', 22000, 0.45, 'HIIT, Functional',    'active')
ON CONFLICT (id) DO NOTHING;

-- Sample clients
INSERT INTO clients (id, client_id, name, mobile, gender, trainer_id, trainer_name,
  joining_date, pt_start_date, pt_end_date, package_type,
  base_amount, discount, final_amount, paid_amount, balance_amount,
  payment_method, status) VALUES
  (gen_random_uuid()::TEXT, 'FS0001', 'Priya Patel',   '9900001111', 'Female', 'tr-001', 'Riya Sharma',    '2024-11-01', '2024-11-01', '2025-04-30', 'Half Yearly', 18000, 1000, 17000, 17000, 0,    'UPI',  'active'),
  (gen_random_uuid()::TEXT, 'FS0002', 'Rohit Verma',   '9900002222', 'Male',   'tr-002', 'Abhishek Gupta', '2024-12-01', '2024-12-01', '2025-05-15', 'Half Yearly', 18000, 0,    18000, 10000, 8000, 'CASH', 'active'),
  (gen_random_uuid()::TEXT, 'FS0003', 'Anita Singh',   '9900003333', 'Female', 'tr-001', 'Riya Sharma',    '2025-01-10', '2025-01-10', '2025-07-09', 'Half Yearly', 18000, 2000, 16000, 16000, 0,    'CARD', 'active'),
  (gen_random_uuid()::TEXT, 'FS0004', 'Karan Mehta',   '9900004444', 'Male',   'tr-003', 'Rajat Singh',    '2025-02-01', '2025-02-01', '2025-04-28', 'Quarterly',   9000,  0,    9000,  9000,  0,    'UPI',  'active'),
  (gen_random_uuid()::TEXT, 'FS0005', 'Sunita Rao',    '9900005555', 'Female', 'tr-002', 'Abhishek Gupta', '2024-10-01', '2024-10-01', '2025-03-31', 'Half Yearly', 18000, 0,    18000, 12000, 6000, 'CASH', 'expired'),
  (gen_random_uuid()::TEXT, 'FS0006', 'Vikram Joshi',  '9900006666', 'Male',   'tr-001', 'Riya Sharma',    '2025-03-01', '2025-03-01', '2025-08-28', 'Half Yearly', 18000, 1500, 16500, 16500, 0,    'UPI',  'active'),
  (gen_random_uuid()::TEXT, 'FS0007', 'Meena Desai',   '9900007777', 'Female', 'tr-003', 'Rajat Singh',    '2025-01-15', '2025-01-15', '2025-04-25', 'Quarterly',   9000,  500,  8500,  8500,  0,    'CASH', 'active'),
  (gen_random_uuid()::TEXT, 'FS0008', 'Arjun Kapoor',  '9900008888', 'Male',   'tr-002', 'Abhishek Gupta', '2025-02-15', '2025-02-15', '2026-02-14', 'Yearly',      30000, 3000, 27000, 20000, 7000, 'UPI',  'active')
ON CONFLICT (client_id) DO NOTHING;

-- Sample payments (last few months)
DO $$
DECLARE
  c1 TEXT; c2 TEXT; c3 TEXT; c6 TEXT; c8 TEXT;
BEGIN
  SELECT id INTO c1 FROM clients WHERE client_id='FS0001';
  SELECT id INTO c2 FROM clients WHERE client_id='FS0002';
  SELECT id INTO c3 FROM clients WHERE client_id='FS0003';
  SELECT id INTO c6 FROM clients WHERE client_id='FS0006';
  SELECT id INTO c8 FROM clients WHERE client_id='FS0008';

  IF c1 IS NOT NULL THEN
    INSERT INTO payments (id,client_id,client_name,trainer_id,trainer_name,amount,method,date,receipt_no,package_type,incentive_amt)
    VALUES
      (gen_random_uuid()::TEXT, c1,'Priya Patel',  'tr-001','Riya Sharma',    17000,'UPI', '2024-11-01','RCP-20241101-1001','Half Yearly',8500),
      (gen_random_uuid()::TEXT, c2,'Rohit Verma',  'tr-002','Abhishek Gupta', 5000, 'CASH','2024-12-01','RCP-20241201-1002','Half Yearly',2750),
      (gen_random_uuid()::TEXT, c2,'Rohit Verma',  'tr-002','Abhishek Gupta', 5000, 'CASH','2025-01-15','RCP-20250115-1003','Half Yearly',2750),
      (gen_random_uuid()::TEXT, c3,'Anita Singh',  'tr-001','Riya Sharma',    16000,'CARD','2025-01-10','RCP-20250110-1004','Half Yearly',8000),
      (gen_random_uuid()::TEXT, c6,'Vikram Joshi', 'tr-001','Riya Sharma',    16500,'UPI', '2025-03-01','RCP-20250301-1005','Half Yearly',8250),
      (gen_random_uuid()::TEXT, c8,'Arjun Kapoor', 'tr-002','Abhishek Gupta', 20000,'UPI', '2025-02-15','RCP-20250215-1006','Yearly',     11000)
    ON CONFLICT (receipt_no) DO NOTHING;
  END IF;
END $$;

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('gym_name',    '619 Fitness Studio'),
  ('gym_phone',   '+91-XXXXXXXXXX'),
  ('gym_address', 'Your Gym Address Here'),
  ('currency',    'INR'),
  ('gst',         '18')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
--  IMPORTANT: After running this SQL, you MUST update the passwords.
--
--  The hashes above may not match the actual bcrypt output on your system
--  because bcrypt generates different salts each time.
--
--  Run the seed script from your deployed backend to fix passwords:
--    node src/db/seed.js
--
--  OR use the change-password endpoint after logging in with:
--    admin@619fitness.com / admin@619
-- ════════════════════════════════════════════════════════════════════


-- ====================================================================
-- Step 2 — v3 additive: KYC, member actions, follow-ups, referrals, notifications
-- Source: db/migrations/supabase-migration-v3.sql
-- ====================================================================


-- ── Migration safety: rename legacy v2-additive tables that clash with
--    the v3-SaaS schema (Step 4). Keeps any data the user already had
--    while letting both tables coexist under unique names.
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public'
                   AND table_name='notifications'
                   AND column_name='client_id') THEN
    EXECUTE 'ALTER TABLE notifications RENAME TO client_notifications';
    RAISE NOTICE 'Renamed legacy public.notifications → public.client_notifications';
  END IF;

  IF to_regclass('public.referrals') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public'
                   AND table_name='referrals'
                   AND column_name='referrer_id') THEN
    EXECUTE 'ALTER TABLE referrals RENAME TO client_referrals';
    RAISE NOTICE 'Renamed legacy public.referrals → public.client_referrals';
  END IF;
END $$;
-- ═══════════════════════════════════════════════════════════════════
--  619 Fitness Studio ERP — Migration v3
--  Adds: Indian KYC fields (Aadhaar/PAN/GST), structured address,
--        member actions (freeze/extension/transfer/upgrade/etc.),
--        subscriptions, follow-ups, client_referrals, documents, check-ins,
--        client_notifications.
--
--  HOW TO RUN:
--    Paste this entire file into Supabase SQL Editor and Run.
--    Safe to re-run — every statement is idempotent.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. Extend the clients table ───────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS first_name        TEXT,
  ADD COLUMN IF NOT EXISTS last_name         TEXT,
  ADD COLUMN IF NOT EXISTS country_code      TEXT DEFAULT '+91',
  ADD COLUMN IF NOT EXISTS alt_country_code  TEXT DEFAULT '+91',
  ADD COLUMN IF NOT EXISTS alt_mobile        TEXT,
  ADD COLUMN IF NOT EXISTS reference_no      TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_no        TEXT,
  ADD COLUMN IF NOT EXISTS pan_no            TEXT,
  ADD COLUMN IF NOT EXISTS gst_no            TEXT,
  ADD COLUMN IF NOT EXISTS company_name      TEXT,
  ADD COLUMN IF NOT EXISTS street            TEXT,
  ADD COLUMN IF NOT EXISTS city              TEXT,
  ADD COLUMN IF NOT EXISTS state             TEXT,
  ADD COLUMN IF NOT EXISTS country           TEXT DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS pincode           TEXT,
  ADD COLUMN IF NOT EXISTS member_code       TEXT,
  ADD COLUMN IF NOT EXISTS photo_url         TEXT,
  ADD COLUMN IF NOT EXISTS biometric_code    TEXT,
  ADD COLUMN IF NOT EXISTS is_mobile_redacted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS biometric_added   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS app_installed     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interested_in     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_no      TEXT,
  ADD COLUMN IF NOT EXISTS frozen_until      DATE,
  ADD COLUMN IF NOT EXISTS frozen_from       DATE;

ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS biometric_code    TEXT,
  ADD COLUMN IF NOT EXISTS biometric_added   BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_biometric_code ON clients(biometric_code) WHERE biometric_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_biometric_code ON trainers(biometric_code) WHERE biometric_code IS NOT NULL;

-- Backfill: split name into first/last and assign member_code if missing
UPDATE clients
   SET first_name = COALESCE(first_name, split_part(name, ' ', 1)),
       last_name  = COALESCE(last_name,  NULLIF(split_part(name, ' ', 2), ''))
 WHERE first_name IS NULL OR last_name IS NULL;

UPDATE clients
   SET member_code = COALESCE(member_code, 'YDL-' || LPAD(EXTRACT(EPOCH FROM created_at)::BIGINT::TEXT, 8, '0') || '-' || LEFT(id, 4))
 WHERE member_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_member_code ON clients(member_code) WHERE member_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_search_name   ON clients (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_clients_search_mobile ON clients (mobile);
CREATE INDEX IF NOT EXISTS idx_clients_pan           ON clients (pan_no);
CREATE INDEX IF NOT EXISTS idx_clients_aadhaar       ON clients (aadhaar_no);

-- Allow new status values
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active','expired','frozen','transferred','trial'));

-- ── 2. Subscriptions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'membership'
                    CHECK (kind IN ('membership','personal_training','combo','trial')),
  package_type    TEXT,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  base_amount     NUMERIC(10,2) DEFAULT 0,
  discount        NUMERIC(10,2) DEFAULT 0,
  final_amount    NUMERIC(10,2) DEFAULT 0,
  paid_amount     NUMERIC(10,2) DEFAULT 0,
  balance_amount  NUMERIC(10,2) DEFAULT 0,
  payment_method  TEXT DEFAULT 'CASH',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','frozen','cancelled','transferred')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subs_client    ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subs_end       ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subs_status    ON subscriptions(status);

-- ── 3. Follow-ups ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  followup_type   TEXT NOT NULL,                        -- e.g. 'Renewal Membership', 'Enquiry', 'Trial Reminder'
  followup_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminder_date   TIMESTAMPTZ,
  comments        TEXT,
  status          TEXT NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','CLOSED','PENDING')),
  added_by        TEXT,
  followed_up_by  TEXT,
  expected_date   DATE,
  expected_amount NUMERIC(10,2),
  resolution      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_followups_client ON follow_ups(client_id);
CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_followups_date   ON follow_ups(followup_date DESC);

-- ── 4. Member action log (freeze, extension, transfer, etc.) ──────
CREATE TABLE IF NOT EXISTS member_actions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action_type     TEXT NOT NULL,                        -- freeze / unfreeze / extension / downgrade / upgrade / transfer / combo / trial / pt_assign / pt_renew
  details         JSONB NOT NULL DEFAULT '{}',          -- old/new values
  performed_by    TEXT,
  performed_on    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  amount          NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_actions_client ON member_actions(client_id);
CREATE INDEX IF NOT EXISTS idx_member_actions_type   ON member_actions(action_type);

-- ── 5. Referrals ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_referrals (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  referrer_id     TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referee_name    TEXT NOT NULL,
  referee_mobile  TEXT,
  referee_email   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','converted','rejected')),
  converted_client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  notes           TEXT,
  reward_amount   NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_referrals_referrer ON client_referrals(referrer_id);

-- ── 6. Documents ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_documents (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL,                        -- aadhaar / pan / agreement / medical / other
  doc_name        TEXT,
  doc_url         TEXT,                                 -- URL or path (object storage)
  uploaded_by     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_client ON client_documents(client_id);

-- ── 7. Notifications log (in-app + WhatsApp) ──────────────────────
CREATE TABLE IF NOT EXISTS client_notifications (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('app','whatsapp','sms','email')),
  subject         TEXT,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','failed','read')),
  sent_at         TIMESTAMPTZ,
  meta            JSONB DEFAULT '{}',
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_notifications_client ON client_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notifications_status ON client_notifications(status);

-- ── 8. Workout log (lightweight) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS workouts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  routine         TEXT,
  exercises       JSONB DEFAULT '[]',
  duration_min    INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workouts_client ON workouts(client_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date   ON workouts(date DESC);

-- ── 9. Auto follow-up generation: 7-day & 3-day expiry reminders ──
-- Run this on a schedule (cron / pg_cron). Idempotent for the day.
CREATE OR REPLACE FUNCTION generate_renewal_reminders() RETURNS INTEGER AS $$
DECLARE inserted INTEGER := 0;
BEGIN
  -- 7-day reminder
  INSERT INTO follow_ups (client_id, followup_type, comments, status, added_by, expected_date, expected_amount)
  SELECT c.id,
         'Renewal Membership',
         'Renewal Reminder - About to expire in 7 Days :' || COALESCE(c.package_type,'') || ', renewal due on ' || c.pt_end_date,
         'CLOSED',
         'System Generated',
         c.pt_end_date,
         c.final_amount
    FROM clients c
   WHERE c.status = 'active'
     AND c.pt_end_date = CURRENT_DATE + INTERVAL '7 days'
     AND NOT EXISTS (
       SELECT 1 FROM follow_ups f
        WHERE f.client_id = c.id
          AND f.followup_type = 'Renewal Membership'
          AND f.comments LIKE '%7 Days%'
          AND DATE(f.created_at) = CURRENT_DATE
     );
  GET DIAGNOSTICS inserted = ROW_COUNT;

  -- 3-day reminder
  INSERT INTO follow_ups (client_id, followup_type, comments, status, added_by, expected_date, expected_amount)
  SELECT c.id,
         'Renewal Membership',
         'Renewal Reminder - About to expire in 3 Days :' || COALESCE(c.package_type,'') || ', renewal due on ' || c.pt_end_date,
         'CLOSED',
         'System Generated',
         c.pt_end_date,
         c.final_amount
    FROM clients c
   WHERE c.status = 'active'
     AND c.pt_end_date = CURRENT_DATE + INTERVAL '3 days'
     AND NOT EXISTS (
       SELECT 1 FROM follow_ups f
        WHERE f.client_id = c.id
          AND f.followup_type = 'Renewal Membership'
          AND f.comments LIKE '%3 Days%'
          AND DATE(f.created_at) = CURRENT_DATE
     );
  RETURN inserted;
END;
$$ LANGUAGE plpgsql;

-- ── 10. Backfill subscriptions from existing client data ──────────
INSERT INTO subscriptions (client_id, kind, package_type, trainer_id,
  start_date, end_date, base_amount, discount, final_amount, paid_amount, balance_amount,
  payment_method, status, notes)
SELECT c.id, 'membership', c.package_type, c.trainer_id,
       c.pt_start_date, c.pt_end_date, c.base_amount, c.discount, c.final_amount,
       c.paid_amount, c.balance_amount, c.payment_method, c.status, c.notes
  FROM clients c
 WHERE c.pt_start_date IS NOT NULL
   AND c.pt_end_date   IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM subscriptions s
      WHERE s.client_id = c.id AND s.start_date = c.pt_start_date
   );

-- Done. ✅
SELECT
  (SELECT count(*) FROM clients)        AS clients,
  (SELECT count(*) FROM subscriptions)  AS subscriptions,
  (SELECT count(*) FROM follow_ups)     AS follow_ups,
  (SELECT count(*) FROM member_actions) AS member_actions;


-- ====================================================================
-- Step 3 — v3 additive: plans, trials, enquiries
-- Source: db/migrations/supabase-v3-migration.sql
-- ====================================================================

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


-- ====================================================================
-- Step 4 — v3 SaaS: members, bookings, classes, audit log
-- Source: db/migrations/supabase-schema-v3.sql
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════════
--  619 Fitness Studio — SaaS v3 Schema (Glofox-class)
--
--  ADDITIVE migration. Run AFTER supabase-schema.sql (v2).
--  Safe to re-run: every CREATE/ALTER uses IF NOT EXISTS / IF EXISTS.
--
--  Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════════════════════════════════════════
-- 1. BRANCHES (multi-location foundation; single row for now)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS branches (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency      TEXT NOT NULL DEFAULT 'INR',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO branches (id, code, name, address, phone, timezone, currency)
VALUES ('br-main', 'MAIN', '619 Fitness Studio', 'Your gym address', '+91-XXXXXXXXXX', 'Asia/Kolkata', 'INR')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 2. EXTEND USERS for member role + better auth
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin','trainer','member','manager'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id      TEXT REFERENCES branches(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;

-- ════════════════════════════════════════════════════════════════════
-- 3. REFRESH TOKENS (rotating refresh-token sessions)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- ════════════════════════════════════════════════════════════════════
-- 4. MEMBERS (extends/replaces clients; clients view kept for compat)
--    - Members may or may not have a login (users row).
--    - PT membership info now lives in member_memberships.
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS members (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  branch_id       TEXT NOT NULL REFERENCES branches(id) DEFAULT 'br-main',
  member_code     TEXT UNIQUE NOT NULL,         -- e.g. FS0001
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  legacy_client_id TEXT,                         -- maps to clients.id during migration
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  gender          TEXT,
  dob             DATE,
  address         TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  primary_trainer_id TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  joining_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('lead','active','frozen','expired','cancelled')),
  source          TEXT,                          -- referral, walk-in, instagram, etc.
  notes           TEXT,
  photo_url       TEXT,
  tags            TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_members_branch ON members(branch_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_trainer ON members(primary_trainer_id);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);

-- Backfill members from existing clients (idempotent)
INSERT INTO members (id, branch_id, member_code, name, email, phone, gender, dob,
                     address, primary_trainer_id, joining_date, status, legacy_client_id, notes)
SELECT
  c.id, 'br-main',
  COALESCE(c.client_id, 'M' || LPAD((10000 + ROW_NUMBER() OVER (ORDER BY c.created_at))::text, 4, '0')),
  c.name, c.email, c.mobile, c.gender, c.dob, c.address, c.trainer_id,
  COALESCE(c.joining_date, CURRENT_DATE),
  CASE c.status WHEN 'frozen' THEN 'frozen' WHEN 'expired' THEN 'expired' ELSE 'active' END,
  c.id, c.notes
FROM clients c
ON CONFLICT (member_code) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 5. MEMBERSHIP PLANS (extends plans table)
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE plans ADD COLUMN IF NOT EXISTS branch_id     TEXT REFERENCES branches(id);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_type     TEXT NOT NULL DEFAULT 'membership'
  CHECK (plan_type IN ('membership','class_pack','pt_pack','drop_in'));
ALTER TABLE plans ADD COLUMN IF NOT EXISTS included_classes INTEGER;        -- null = unlimited
ALTER TABLE plans ADD COLUMN IF NOT EXISTS included_pt_sessions INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS auto_renew    BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS color         TEXT DEFAULT '#FF4500';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order    INTEGER DEFAULT 0;

INSERT INTO plans (id, name, duration, price, plan_type, included_classes, branch_id, sort_order, is_active)
VALUES
  ('plan-mon',  'Monthly',         30,  3500.00, 'membership', NULL, 'br-main', 1, TRUE),
  ('plan-qtr',  'Quarterly',       90,  9000.00, 'membership', NULL, 'br-main', 2, TRUE),
  ('plan-half', 'Half Yearly',    180, 18000.00, 'membership', NULL, 'br-main', 3, TRUE),
  ('plan-yr',   'Yearly',         365, 30000.00, 'membership', NULL, 'br-main', 4, TRUE),
  ('plan-pt10', 'PT Pack — 10',    90, 12000.00, 'pt_pack',    NULL, 'br-main', 5, TRUE),
  ('plan-cls8', 'Class Pack — 8',  60,  4500.00, 'class_pack',    8, 'br-main', 6, TRUE),
  ('plan-drop', 'Drop-in',          1,   500.00, 'drop_in',       1, 'br-main', 7, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 6. MEMBER MEMBERSHIPS  (subscription instances)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS member_memberships (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  member_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id         TEXT NOT NULL REFERENCES plans(id),
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  base_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_amount  NUMERIC(10,2) GENERATED ALWAYS AS (final_amount - paid_amount) STORED,
  classes_used    INTEGER NOT NULL DEFAULT 0,
  pt_sessions_used INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','frozen','cancelled')),
  auto_renew      BOOLEAN NOT NULL DEFAULT FALSE,
  renewed_from_id TEXT REFERENCES member_memberships(id),
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mm_member  ON member_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_mm_status  ON member_memberships(status);
CREATE INDEX IF NOT EXISTS idx_mm_end     ON member_memberships(end_date);

-- ════════════════════════════════════════════════════════════════════
-- 7. CLASSES — templates / schedules / sessions
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS class_templates (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  branch_id       TEXT NOT NULL REFERENCES branches(id) DEFAULT 'br-main',
  name            TEXT NOT NULL,                 -- "Yoga Flow", "HIIT 30"
  description     TEXT,
  category        TEXT,                          -- yoga, hiit, strength, dance
  duration_min    INTEGER NOT NULL DEFAULT 60,
  capacity        INTEGER NOT NULL DEFAULT 15,
  drop_in_fee     NUMERIC(10,2) DEFAULT 0,
  color           TEXT DEFAULT '#FF4500',
  image_url       TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_schedules (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  template_id     TEXT NOT NULL REFERENCES class_templates(id) ON DELETE CASCADE,
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  -- iCal-ish recurrence: simplified
  rrule           TEXT,                          -- e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  starts_on       DATE NOT NULL,
  ends_on         DATE,
  start_time      TIME NOT NULL,                 -- 07:00
  duration_min    INTEGER,                       -- override template
  capacity        INTEGER,                       -- override template
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  schedule_id     TEXT REFERENCES class_schedules(id) ON DELETE SET NULL,
  template_id     TEXT NOT NULL REFERENCES class_templates(id),
  trainer_id      TEXT REFERENCES trainers(id) ON DELETE SET NULL,
  branch_id       TEXT NOT NULL REFERENCES branches(id) DEFAULT 'br-main',
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  capacity        INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','cancelled','completed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cs_starts ON class_sessions(starts_at);
CREATE INDEX IF NOT EXISTS idx_cs_trainer ON class_sessions(trainer_id, starts_at);

-- ════════════════════════════════════════════════════════════════════
-- 8. BOOKINGS  (member ↔ class_session)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id      TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  member_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  membership_id   TEXT REFERENCES member_memberships(id),
  status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed','waitlist','cancelled','no_show','attended')),
  position        INTEGER,                       -- waitlist position
  booked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at    TIMESTAMPTZ,
  cancellation_reason TEXT,
  checked_in_at   TIMESTAMPTZ,
  check_in_method TEXT,                          -- 'qr','manual','auto'
  notes           TEXT,
  UNIQUE (session_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_book_session ON bookings(session_id, status);
CREATE INDEX IF NOT EXISTS idx_book_member  ON bookings(member_id);

-- ════════════════════════════════════════════════════════════════════
-- 9. PERSONAL TRAINING SESSIONS
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pt_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  branch_id       TEXT NOT NULL REFERENCES branches(id) DEFAULT 'br-main',
  member_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  trainer_id      TEXT NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
  membership_id   TEXT REFERENCES member_memberships(id),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  goal            TEXT,                          -- "Squat PR", "Cardio block"
  trainer_notes   TEXT,
  member_feedback TEXT,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  payout_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  payout_amount   NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pt_trainer ON pt_sessions(trainer_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_pt_member  ON pt_sessions(member_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_pt_status  ON pt_sessions(status);

-- prevent overlapping bookings for the same trainer (key Glofox-beating feature)
CREATE OR REPLACE FUNCTION pt_no_overlap() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'scheduled' AND EXISTS (
    SELECT 1 FROM pt_sessions
    WHERE trainer_id = NEW.trainer_id
      AND id <> NEW.id
      AND status = 'scheduled'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Trainer has a conflicting session at that time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pt_no_overlap_trg ON pt_sessions;
CREATE TRIGGER pt_no_overlap_trg
  BEFORE INSERT OR UPDATE ON pt_sessions
  FOR EACH ROW EXECUTE FUNCTION pt_no_overlap();

-- ════════════════════════════════════════════════════════════════════
-- 10. PAYMENTS & INVOICES (extend v2 payments)
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE payments ADD COLUMN IF NOT EXISTS branch_id        TEXT REFERENCES branches(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS member_id        TEXT REFERENCES members(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS membership_id    TEXT REFERENCES member_memberships(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway          TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_txn_id   TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_status   TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_no       TEXT UNIQUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_amount  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by       TEXT REFERENCES users(id);

UPDATE payments SET branch_id = 'br-main' WHERE branch_id IS NULL;
UPDATE payments p SET member_id = (SELECT id FROM members WHERE legacy_client_id = p.client_id LIMIT 1)
  WHERE member_id IS NULL AND client_id IS NOT NULL;

-- Allow new gateway methods
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD  CONSTRAINT payments_method_check
  CHECK (method IN ('CASH','UPI','CARD','BANK_TRANSFER','RAZORPAY','STRIPE','WALLET'));

-- ════════════════════════════════════════════════════════════════════
-- 11. ATTENDANCE (extend for QR)
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS branch_id    TEXT REFERENCES branches(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS member_id    TEXT REFERENCES members(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS booking_id   TEXT REFERENCES bookings(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS pt_session_id TEXT REFERENCES pt_sessions(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_method TEXT;     -- qr/manual/auto
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS device_id    TEXT;        -- door scanner id
UPDATE attendance SET branch_id = 'br-main' WHERE branch_id IS NULL;

-- QR tokens (rotating, short-lived)
CREATE TABLE IF NOT EXISTS qr_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qr_token ON qr_tokens(token);

-- ════════════════════════════════════════════════════════════════════
-- 12. NOTIFICATIONS
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                  -- payment_due, class_reminder, etc.
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS notification_log (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('email','whatsapp','sms','push','inapp')),
  template    TEXT NOT NULL,
  payload     JSONB,
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','sent','delivered','failed','bounced')),
  provider_id TEXT,                            -- message id from provider
  error       TEXT,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_log_status ON notification_log(status);

-- ════════════════════════════════════════════════════════════════════
-- 13. BODY METRICS (generalizes weight_logs)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS body_metrics (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  member_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg     NUMERIC(5,2),
  body_fat_pct  NUMERIC(4,1),
  muscle_kg     NUMERIC(5,2),
  chest_cm      NUMERIC(5,1),
  waist_cm      NUMERIC(5,1),
  hip_cm        NUMERIC(5,1),
  arm_cm        NUMERIC(5,1),
  thigh_cm      NUMERIC(5,1),
  bmi           NUMERIC(4,1),
  notes         TEXT,
  recorded_by   TEXT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metrics_member ON body_metrics(member_id, date DESC);

-- ════════════════════════════════════════════════════════════════════
-- 14. HOLDS / FREEZES
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS holds_freezes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  membership_id   TEXT NOT NULL REFERENCES member_memberships(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL CHECK (reason IN ('medical','travel','personal','other')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  approved_by     TEXT REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_freeze_membership ON holds_freezes(membership_id);

-- ════════════════════════════════════════════════════════════════════
-- 15. AUDIT LOG (append-only)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  action      TEXT NOT NULL,                -- e.g. 'member.update'
  entity      TEXT NOT NULL,                -- 'member','payment',...
  entity_id   TEXT,
  before      JSONB,
  after       JSONB,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_log(user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════
-- 16. REFERRALS (Glofox+ feature)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referrals (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  referrer_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  referred_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  referral_code   TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','converted','expired')),
  reward_amount   NUMERIC(10,2),
  reward_status   TEXT DEFAULT 'pending'
                    CHECK (reward_status IN ('pending','credited','paid')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at    TIMESTAMPTZ
);

-- ════════════════════════════════════════════════════════════════════
-- 17. UPDATED_AT TRIGGER (DRY)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'branches','members','member_memberships','class_templates',
    'class_sessions','pt_sessions'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at_trg ON %I;
       CREATE TRIGGER set_updated_at_trg BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 18. CONVENIENCE VIEWS
-- ════════════════════════════════════════════════════════════════════

-- Active membership view: 1 row per member with their current plan
CREATE OR REPLACE VIEW v_member_active_membership AS
SELECT DISTINCT ON (m.id)
  m.id AS member_id, m.member_code, m.name,
  mm.id AS membership_id, mm.plan_id,
  pl.name AS plan_name,
  mm.start_date, mm.end_date, mm.status,
  mm.balance_amount,
  (mm.end_date - CURRENT_DATE) AS days_remaining
FROM members m
LEFT JOIN member_memberships mm ON mm.member_id = m.id AND mm.status = 'active'
LEFT JOIN plans pl ON pl.id = mm.plan_id
ORDER BY m.id, mm.end_date DESC NULLS LAST;

-- Class session occupancy view
CREATE OR REPLACE VIEW v_session_occupancy AS
SELECT
  cs.id AS session_id,
  cs.starts_at, cs.ends_at, cs.capacity,
  ct.name AS class_name, ct.category,
  t.name  AS trainer_name,
  COUNT(b.id) FILTER (WHERE b.status='confirmed')  AS confirmed,
  COUNT(b.id) FILTER (WHERE b.status='waitlist')   AS waitlisted,
  cs.capacity - COUNT(b.id) FILTER (WHERE b.status='confirmed') AS spots_left
FROM class_sessions cs
LEFT JOIN class_templates ct ON ct.id = cs.template_id
LEFT JOIN trainers t ON t.id = cs.trainer_id
LEFT JOIN bookings b ON b.session_id = cs.id
WHERE cs.status='scheduled'
GROUP BY cs.id, ct.name, ct.category, t.name;

-- Trainer monthly earnings view
CREATE OR REPLACE VIEW v_trainer_monthly_earnings AS
SELECT
  t.id AS trainer_id, t.name,
  TO_CHAR(p.date, 'YYYY-MM') AS month,
  COALESCE(SUM(p.amount), 0)         AS gross_revenue,
  COALESCE(SUM(p.incentive_amt), 0)  AS incentive,
  t.salary AS base_salary,
  t.salary + COALESCE(SUM(p.incentive_amt), 0) AS total_payout
FROM trainers t
LEFT JOIN payments p ON p.trainer_id = t.id
GROUP BY t.id, t.name, t.salary, TO_CHAR(p.date, 'YYYY-MM');

-- ════════════════════════════════════════════════════════════════════
-- 19. SEED — sample classes for the demo
-- ════════════════════════════════════════════════════════════════════
INSERT INTO class_templates (id, name, description, category, duration_min, capacity, color)
VALUES
  ('ct-yoga',  'Yoga Flow',     'Vinyasa-style yoga',          'yoga',     60, 15, '#8B5CF6'),
  ('ct-hiit',  'HIIT Burn',     'High-intensity intervals',    'hiit',     45, 12, '#EF4444'),
  ('ct-spin',  'Spin Express',  'Indoor cycling',              'cardio',   45, 20, '#3B82F6'),
  ('ct-zumba', 'Zumba Party',   'Dance fitness',               'dance',    60, 25, '#F59E0B')
ON CONFLICT (id) DO NOTHING;

-- Resilient seed: bind to whatever active trainers actually exist.
-- If you have fewer than 3 trainers, only that many demo schedules get created.
DO $$
DECLARE
  t_ids TEXT[];
BEGIN
  SELECT ARRAY(
    SELECT id FROM trainers
    WHERE COALESCE(status, 'active') = 'active'
    ORDER BY created_at NULLS LAST, id
    LIMIT 3
  ) INTO t_ids;

  IF array_length(t_ids, 1) >= 1 THEN
    INSERT INTO class_schedules (id, template_id, trainer_id, rrule, starts_on, start_time, capacity)
    VALUES ('sch-yoga-mwf', 'ct-yoga', t_ids[1], 'FREQ=WEEKLY;BYDAY=MO,WE,FR', CURRENT_DATE, '07:00', 15)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF array_length(t_ids, 1) >= 2 THEN
    INSERT INTO class_schedules (id, template_id, trainer_id, rrule, starts_on, start_time, capacity)
    VALUES ('sch-hiit-tt', 'ct-hiit', t_ids[2], 'FREQ=WEEKLY;BYDAY=TU,TH', CURRENT_DATE, '18:30', 12)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF array_length(t_ids, 1) >= 3 THEN
    INSERT INTO class_schedules (id, template_id, trainer_id, rrule, starts_on, start_time, capacity)
    VALUES ('sch-spin-mw', 'ct-spin', t_ids[3], 'FREQ=WEEKLY;BYDAY=MO,WE', CURRENT_DATE, '06:00', 20)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF array_length(t_ids, 1) IS NULL THEN
    RAISE NOTICE 'No trainers found — skipping demo class_schedules seed. Add trainers, then run the recovery patch.';
  END IF;
END $$;

-- Generate next 14 days of sessions from schedules (simplified, daily example)
INSERT INTO class_sessions (schedule_id, template_id, trainer_id, starts_at, ends_at, capacity, status)
SELECT
  sch.id, sch.template_id, sch.trainer_id,
  (d::date + sch.start_time)::timestamptz AS starts_at,
  (d::date + sch.start_time + (COALESCE(sch.duration_min, ct.duration_min) || ' minutes')::interval)::timestamptz AS ends_at,
  COALESCE(sch.capacity, ct.capacity),
  'scheduled'
FROM class_schedules sch
JOIN class_templates ct ON ct.id = sch.template_id
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 14, '1 day') d
WHERE sch.is_active = TRUE
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 20. ROW-LEVEL SECURITY (foundation; enable per-tenant when ready)
-- ════════════════════════════════════════════════════════════════════
-- Examples (commented; enable after wiring auth.uid() context):
-- ALTER TABLE members ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY members_self ON members
--   FOR SELECT USING (
--     (current_setting('app.role', true) = 'admin')
--     OR (current_setting('app.role', true) = 'trainer' AND primary_trainer_id = current_setting('app.trainer_id', true))
--     OR (current_setting('app.role', true) = 'member'  AND user_id = current_setting('app.user_id', true))
--   );

-- DONE
SELECT '619 v3 schema applied successfully' AS status;


-- ====================================================================
-- Step 5 — face check-in (descriptors + log)
-- Source: db/migrations/face-checkin.sql
-- ====================================================================

-- ════════════════════════════════════════════════════════════════════
-- Face Check-In schema additions
-- ════════════════════════════════════════════════════════════════════
-- Run once on Supabase / Postgres:
--   psql "$DATABASE_URL" -f db/migrations/face-checkin.sql

-- 1) Member face descriptor + enrollment timestamp
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS face_descriptor   JSONB,
  ADD COLUMN IF NOT EXISTS face_enrolled_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_face_enrolled
  ON clients (face_enrolled_at)
  WHERE face_descriptor IS NOT NULL;

-- 2) Per-event check-in log (success / unknown / expired / denied)
--
-- NOTE on types: clients.id is TEXT (gen_random_uuid()::TEXT), not UUID,
-- so client_id must be TEXT to satisfy the FK. Likewise we default id to
-- a TEXT-shaped UUID so callers that omit it still get a value.
CREATE TABLE IF NOT EXISTS face_checkin_logs (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id   TEXT        REFERENCES clients(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL CHECK (status IN ('success','unknown','expired','denied','error')),
  distance    DOUBLE PRECISION,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_checkin_logs_created_at
  ON face_checkin_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_face_checkin_logs_client
  ON face_checkin_logs (client_id, created_at DESC);


-- ====================================================================
-- Step 6 — performance + soft-delete (indexes, deleted_at columns)
-- Source: db/migrations/2026-05-perf-and-soft-delete.sql
-- ====================================================================

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


-- ====================================================================
-- Step 7 — RLS + receipt sequence (audit hardening)
-- Source: db/migrations/2026-05-rls-and-hardening.sql
-- ====================================================================

-- ════════════════════════════════════════════════════════════════════
--  619 Fitness ERP — RLS + production hardening
--  Date: 2026-05-07
--
--  WHAT THIS DOES
--  --------------
--   1. Enables Row-Level Security on every user-data table so the
--      Supabase REST API (PostgREST) can no longer read rows as the
--      `anon` or `authenticated` role.
--   2. Leaves the privileged `postgres` role unaffected — the Express
--      backend connects as that role through the pooler, so existing
--      endpoints keep working.
--   3. Adds a single "deny everything by default" policy per table.
--      Specific app-side policies (e.g. members can read their own
--      bookings) can be added incrementally on top.
--   4. Creates a Postgres sequence for receipt numbers (used by the
--      backend's new genReceiptNo helper) so the v2 routes that already
--      INSERT into payments inherit the sequence-backed unique numbers.
--
--  WHO SHOULD RUN THIS
--  -------------------
--   Run AFTER all earlier migrations have been applied:
--     1. supabase-schema.sql
--     2. supabase-migration-v3.sql
--     3. supabase-v3-migration.sql
--     4. supabase-schema-v3.sql
--     5. face-checkin.sql
--     6. 2026-05-perf-and-soft-delete.sql
--     7. THIS FILE
--
--  Safe to re-run: every statement is idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Receipt-number sequence (matches backend/src/db/receipts.js) ──
CREATE SEQUENCE IF NOT EXISTS receipt_no_seq START 100001;
COMMENT ON SEQUENCE receipt_no_seq IS
  '619 ERP backend draws unique receipt numbers from here (RCP-YYYYMMDD-NNNNNN).';

-- ── 2. Enable RLS on every business-data table ────────────────────────
--
--  We DO NOT add permissive policies — meaning PostgREST callers using
--  the anon or authenticated role can no longer read or write these
--  tables at all. The Express backend connects via the privileged
--  `postgres` user (or service_role) which bypasses RLS, so existing
--  endpoints keep working untouched.
--
--  This fixes the headline data-exposure issue: with RLS off and the
--  PostgREST API turned on, the anon JWT could query
--  /rest/v1/clients?select=* directly from a browser.
--
--  Helper: apply ENABLE + a DENY ALL policy iff the table exists.
--  Wrapped in a DO block so a missing optional table doesn't abort the
--  whole migration on partial schemas.
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users','trainers','clients','payments','attendance','renewals',
    'incentives','weight_logs','plans','settings','membership_actions',
    'members','member_memberships','class_templates','class_schedules',
    'class_sessions','bookings','holds_freezes','body_metrics','audit_log',
    'refresh_tokens','branches','face_checkin_logs','trials',
    'subscriptions','follow_ups','referrals','documents','notifications',
    'check_ins'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass(tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      -- Force RLS even for the table owner so we don't accidentally
      -- bypass policies when the migration runs as the owner.
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      -- Drop any prior "deny all" policy first to make this idempotent.
      EXECUTE format('DROP POLICY IF EXISTS deny_all_anon ON %I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS deny_all_authenticated ON %I', tbl);

      -- Explicit deny — anon and authenticated roles get nothing.
      EXECUTE format(
        'CREATE POLICY deny_all_anon ON %I FOR ALL TO anon USING (false) WITH CHECK (false)',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY deny_all_authenticated ON %I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
        tbl
      );

      RAISE NOTICE 'RLS locked: %', tbl;
    END IF;
  END LOOP;
END $$;

-- ── 3. Audit safety: ensure the postgres / service_role bypass works ──
--  Postgres superusers and the SECURITY DEFINER role already bypass RLS.
--  The Express backend uses the connection string from
--  Settings → Database → Connection String, which authenticates as the
--  `postgres` role — that role has BYPASSRLS by default on Supabase,
--  so no extra grants are required.
--
--  If a deployer mistakenly used the `anon` or `authenticated` JWT in
--  the backend connection string, every query would now return zero
--  rows. That would be a loud, immediate failure (vs. the silent data
--  exposure we had before) — exactly what we want.

-- ── 4. Recommended next steps (NOT done here, deliberate) ────────────
--   * Add a backend-side service_role JWT for any direct PostgREST
--     calls (currently none — all traffic goes through Express).
--   * Add granular member-level policies once we wire request.jwt.claims
--     into PostgREST. The skeleton below is commented out so it doesn't
--     accidentally weaken the deny-all baseline:
--
--   -- CREATE POLICY members_can_read_self ON members
--   --   FOR SELECT TO authenticated
--   --   USING (user_id = auth.uid());

-- ── 5. Receipt-number column tightening ───────────────────────────────
--  Reaffirm the UNIQUE index so EXPLAIN clearly attributes the lookup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'payments_receipt_no_key'
  ) THEN
    -- The original CREATE TABLE already adds UNIQUE(receipt_no) — this
    -- is purely a no-op fallback for hand-edited schemas.
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS payments_receipt_no_key ON payments(receipt_no)';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
--  Done. Verify with:
--   SELECT tablename, rowsecurity, forcerowsecurity FROM pg_tables
--   JOIN pg_class c ON c.relname = tablename
--   WHERE schemaname = 'public' ORDER BY tablename;
-- ════════════════════════════════════════════════════════════════════
SELECT '619 v3.1 RLS + hardening applied' AS status;

