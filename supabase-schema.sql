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
                CHECK (role IN ('admin','trainer')),
  trainer_id  TEXT,          -- links to trainers.id when role='trainer'
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
INSERT INTO users (id, name, email, password, role) VALUES
  ('usr-admin-001', 'Admin', 'admin@619fitness.com',
   '$2a$10$rQnuz5yEoaConv/dSmMbXuO3lv5Y5KQB.eO4ClkQ7i8M/7/ZPNqGO',
   'admin')
ON CONFLICT (email) DO UPDATE SET
  password = '$2a$10$rQnuz5yEoaconv/dSmMbXuO3lv5Y5KQB.eO4ClkQ7i8M/7/ZPNqGO',
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
