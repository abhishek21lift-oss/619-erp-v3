-- 619 ERP module workspace schema
-- Additive schema for the shared tab pages used by Sales, Attendance,
-- Finance, Insights, Engagement, Settings, Plans, Reports, and similar
-- operational modules.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS module_records (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  module_key  TEXT NOT NULL,
  title       TEXT NOT NULL,
  owner       TEXT NOT NULL,
  status      TEXT NOT NULL,
  priority    TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  due_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  channel     TEXT NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  branch_id   TEXT REFERENCES branches(id) ON DELETE SET NULL,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT module_records_module_key_check
    CHECK (module_key ~ '^[a-z0-9][a-z0-9-]{0,80}$')
);

CREATE INDEX IF NOT EXISTS idx_module_records_module_due
  ON module_records (module_key, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_module_records_module_status
  ON module_records (module_key, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_module_records_branch
  ON module_records (branch_id)
  WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_module_records_metadata
  ON module_records USING GIN (metadata);

CREATE OR REPLACE FUNCTION set_module_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_module_records_updated_at ON module_records;
CREATE TRIGGER trg_module_records_updated_at
BEFORE UPDATE ON module_records
FOR EACH ROW
EXECUTE FUNCTION set_module_records_updated_at();

COMMENT ON TABLE module_records IS
  'Persistent records for reusable module tab workspaces in the 619 ERP web app.';

SELECT 'module_records schema ready' AS status;
