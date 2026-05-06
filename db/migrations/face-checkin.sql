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
CREATE TABLE IF NOT EXISTS face_checkin_logs (
  id          UUID        PRIMARY KEY,
  client_id   UUID        REFERENCES clients(id) ON DELETE SET NULL,
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
