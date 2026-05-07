-- ════════════════════════════════════════════════════════════════════
-- Face Scan v2 — multi-angle descriptors, branch-scoped logs (Blueprint §3.5)
-- ════════════════════════════════════════════════════════════════════
-- Run once on Supabase / Postgres:
--   psql "$DATABASE_URL" -f db/migrations/2026-05-face-v2.sql
--
-- ADDITIVE. The original `clients.face_descriptor` JSONB column from
-- face-checkin.sql is preserved and back-filled into this child table
-- as the 'median' angle so existing recognition keeps working.
--
-- pgvector is enabled defensively — Supabase ships with it available
-- but not always installed. The vector(128) column lives alongside the
-- JSONB descriptor; switch the read path to it when index is built.

-- 1) face_descriptors child table — one row per (client, angle).
CREATE TABLE IF NOT EXISTS face_descriptors (
  id            TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id     TEXT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  angle         TEXT          NOT NULL
                CHECK (angle IN ('front','left','right','up','down','glasses','median')),
  -- 128 floats from face-api.js. Stored as JSONB until pgvector is on.
  descriptor    JSONB         NOT NULL,
  photo_url     TEXT,
  quality_score NUMERIC(4,3),                -- detector confidence 0-1
  enrolled_by   TEXT,
  enrolled_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  -- One active row per (client, angle). Lets us "replace" by deactivating
  -- the previous one rather than deleting (audit trail).
  UNIQUE (client_id, angle, is_active) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_face_desc_client_active
  ON face_descriptors (client_id) WHERE is_active = TRUE;

-- 2) Optional pgvector column. Populate after enabling the extension.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Add vector column once. Casting JSONB -> vector requires float[] in
    -- Postgres so we do it via array_agg. Safe to re-run.
    BEGIN
      ALTER TABLE face_descriptors
        ADD COLUMN IF NOT EXISTS descriptor_v vector(128);
    EXCEPTION WHEN undefined_object THEN
      -- vector type not registered yet; skip silently
      NULL;
    END;
  END IF;
END$$;

-- HNSW index — only created if pgvector + the column exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'face_descriptors' AND column_name = 'descriptor_v'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_face_desc_v'
  ) THEN
    EXECUTE 'CREATE INDEX idx_face_desc_v
               ON face_descriptors USING hnsw (descriptor_v vector_cosine_ops)
               WITH (m = 16, ef_construction = 64)';
  END IF;
END$$;

-- 3) Backfill from the legacy `clients.face_descriptor` column.
INSERT INTO face_descriptors (client_id, angle, descriptor, enrolled_at, is_active)
SELECT id, 'median', face_descriptor,
       COALESCE(face_enrolled_at, NOW()),
       TRUE
FROM clients
WHERE face_descriptor IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM face_descriptors fd
     WHERE fd.client_id = clients.id AND fd.angle = 'median'
  );

-- 4) Enhance face_checkin_logs for branch / kiosk / liveness attribution.
ALTER TABLE face_checkin_logs
  ADD COLUMN IF NOT EXISTS branch_id      TEXT,
  ADD COLUMN IF NOT EXISTS device_id      TEXT,
  ADD COLUMN IF NOT EXISTS liveness_score NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS direction      TEXT
                           CHECK (direction IN ('in','out')),
  ADD COLUMN IF NOT EXISTS attendance_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_face_logs_branch_day
  ON face_checkin_logs (branch_id, DATE(created_at));

CREATE INDEX IF NOT EXISTS idx_face_logs_device
  ON face_checkin_logs (device_id, created_at DESC)
  WHERE device_id IS NOT NULL;

-- 5) GDPR / DPDP Act 2023 — face consent timestamp on the member.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS face_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS face_deletion_requested_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────────────────────────
--   SELECT angle, COUNT(*) FROM face_descriptors GROUP BY angle;
--   SELECT branch_id, status, COUNT(*) FROM face_checkin_logs
--     WHERE created_at > NOW() - INTERVAL '7 days'
--     GROUP BY branch_id, status;
