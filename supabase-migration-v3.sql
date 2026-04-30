-- ═══════════════════════════════════════════════════════════════════
--  619 Fitness Studio ERP — Migration v3
--  Adds: Indian KYC fields (Aadhaar/PAN/GST), structured address,
--        member actions (freeze/extension/transfer/upgrade/etc.),
--        subscriptions, follow-ups, referrals, documents, check-ins,
--        notifications.
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
  ADD COLUMN IF NOT EXISTS is_mobile_redacted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS biometric_added   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS app_installed     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interested_in     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_no      TEXT,
  ADD COLUMN IF NOT EXISTS frozen_until      DATE,
  ADD COLUMN IF NOT EXISTS frozen_from       DATE;

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
CREATE TABLE IF NOT EXISTS referrals (
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
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

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
CREATE TABLE IF NOT EXISTS notifications (
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
CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

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
