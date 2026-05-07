-- 20260507000100_member_code_six19.sql
--
-- Convert legacy YDL-* member codes to the new SIX19-#### format.
-- Mirror of db/migrations/2026-05-member-code-six19.sql for the
-- supabase migration runner.

BEGIN;

DROP INDEX IF EXISTS idx_clients_member_code;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_member_code
    ON clients(member_code)
 WHERE member_code IS NOT NULL;

COMMIT;
