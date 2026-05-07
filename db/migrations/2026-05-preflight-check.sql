-- 2026-05-preflight-check.sql
--
-- Read-only preflight checks before running the May 2026 migration set.
-- Run manually in psql (or Supabase SQL editor) and review all result sets.

-- 1) Confirm prerequisite tables exist.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'payments', 'plans', 'trainers', 'face_checkin_logs', 'subscriptions')
ORDER BY tablename;

-- 2) Check subscriptions schema drift (v3 table pre-exists but missing new fields).
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name IN (
    'plan_name', 'discount_amount', 'signup_fee', 'gst_percent',
    'gst_amount', 'receipt_no', 'parent_id', 'auto_renew', 'branch_id'
  )
ORDER BY column_name;

-- 3) Check if face_checkin_logs exists before face-v2 migration.
SELECT to_regclass('public.face_checkin_logs') AS face_checkin_logs_exists;

-- 4) Detect potential member_code collisions before SIX19 rewrite.
SELECT member_code, COUNT(*) AS dup_count
FROM clients
WHERE member_code IS NOT NULL
GROUP BY member_code
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, member_code
LIMIT 50;

SELECT COUNT(*) AS existing_six19_codes
FROM clients
WHERE member_code LIKE 'SIX19-%';

-- 5) Check plans.plan_type constraint values currently active.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.plans'::regclass
  AND contype = 'c'
  AND conname ILIKE '%plan_type%';

-- 6) Confirm runtime has service-level DB access before forced RLS.
-- Expect current_user to be a privileged DB user for backend runtime.
SELECT current_user, session_user;

-- 7) Estimate table sizes to choose migration window for index-heavy scripts.
SELECT
  relname AS table_name,
  n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('clients', 'payments', 'subscriptions', 'face_checkin_logs')
ORDER BY estimated_rows DESC;

-- 8) Optional sanity around receipt_no uniqueness pressure.
SELECT receipt_no, COUNT(*) AS dup_count
FROM payments
WHERE receipt_no IS NOT NULL
GROUP BY receipt_no
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, receipt_no
LIMIT 50;
