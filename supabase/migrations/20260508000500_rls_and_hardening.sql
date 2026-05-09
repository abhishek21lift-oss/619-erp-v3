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
