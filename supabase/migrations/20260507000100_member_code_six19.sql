-- 2026-05-member-code-six19.sql
--
-- Convert legacy YDL-* member codes to the new SIX19-#### format.
--
-- Why: the old migration generated codes like "YDL-17780735-e80b" which
-- exposed an epoch timestamp + UUID prefix and was awkward to read out
-- to a member. We now want sequential, human-friendly codes assigned
-- chronologically by created_at: SIX19-0001, SIX19-0002, ...
--
-- The new client-create handler in backend/src/routes/clients.js issues
-- SIX19-#### codes for any newly inserted client. This migration brings
-- existing rows in line with that scheme.
--
-- Idempotent: running twice is a no-op once all rows have SIX19- codes.

BEGIN;

-- 1. Drop the unique index temporarily so the rewrite never collides
--    mid-update. Re-created at the end.
DROP INDEX IF EXISTS idx_clients_member_code;

-- 2. Renumber every YDL-* (and any NULL) member_code in created_at order
--    so the earliest member becomes SIX19-0001, the next SIX19-0002, etc.
WITH numbered AS (
  SELECT id,
         'SIX19-' || LPAD(
           ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id)::TEXT,
           4, '0'
         ) AS new_code
    FROM clients
   WHERE member_code IS NULL
      OR member_code LIKE 'YDL-%'
)
UPDATE clients c
   SET member_code = n.new_code,
       updated_at  = NOW()
  FROM numbered n
 WHERE c.id = n.id;

-- 3. Re-create the partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_member_code
    ON clients(member_code)
 WHERE member_code IS NOT NULL;

COMMIT;
