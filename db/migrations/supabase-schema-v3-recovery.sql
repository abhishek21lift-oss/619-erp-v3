-- ═══════════════════════════════════════════════════════════════════
--  619 v3 — Recovery patch
--
--  Run this IF the main supabase-schema-v3.sql failed at the
--  class_schedules INSERT due to missing trainer IDs.
--
--  Safe to run multiple times. Idempotent.
-- ═══════════════════════════════════════════════════════════════════

-- 0. First, see what trainers you actually have. If this returns 0 rows,
--    you need to insert at least one trainer before running the rest.
SELECT id, name, status FROM trainers ORDER BY created_at;

-- ─────────────────────────────────────────────────────────────────────
-- 1. (OPTIONAL) Insert demo trainers if you have none.
--    Skip this block if the SELECT above returned rows.
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM trainers) THEN
    INSERT INTO trainers (id, name, mobile, email, role, joining_date, salary, incentive_rate, specialization, status)
    VALUES
      ('tr-001', 'Riya Sharma',    '9876543210', 'riya@619fitness.com',     'Personal Trainer', '2023-01-15', 25000, 0.50, 'Weight Loss, Yoga',    'active'),
      ('tr-002', 'Abhishek Gupta', '9876543211', 'abhishek@619fitness.com', 'Strength Coach',   '2023-03-01', 28000, 0.55, 'Bodybuilding, Cardio', 'active'),
      ('tr-003', 'Rajat Singh',    '9876543212', 'rajat@619fitness.com',    'Cardio Specialist','2024-01-01', 22000, 0.45, 'HIIT, Functional',     'active')
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Inserted 3 demo trainers';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Verify class_templates were seeded by the main migration.
--    If empty, this re-seeds them.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO class_templates (id, name, description, category, duration_min, capacity, color)
VALUES
  ('ct-yoga',  'Yoga Flow',     'Vinyasa-style yoga',          'yoga',     60, 15, '#8B5CF6'),
  ('ct-hiit',  'HIIT Burn',     'High-intensity intervals',    'hiit',     45, 12, '#EF4444'),
  ('ct-spin',  'Spin Express',  'Indoor cycling',              'cardio',   45, 20, '#3B82F6'),
  ('ct-zumba', 'Zumba Party',   'Dance fitness',               'dance',    60, 25, '#F59E0B')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Insert class_schedules using whatever active trainers exist.
--    (This is the part that failed before — now made resilient.)
-- ─────────────────────────────────────────────────────────────────────
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

  RAISE NOTICE 'Created class_schedules for % trainers', COALESCE(array_length(t_ids, 1), 0);
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Generate the next 14 days of class_sessions from those schedules.
--    The original migration tried to do this but never got here.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO class_sessions (schedule_id, template_id, trainer_id, starts_at, ends_at, capacity, status)
SELECT
  sch.id,
  sch.template_id,
  sch.trainer_id,
  (d::date + sch.start_time)::timestamptz AS starts_at,
  (d::date + sch.start_time + (COALESCE(sch.duration_min, ct.duration_min) || ' minutes')::interval)::timestamptz AS ends_at,
  COALESCE(sch.capacity, ct.capacity),
  'scheduled'
FROM class_schedules sch
JOIN class_templates ct ON ct.id = sch.template_id
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 14, '1 day') d
WHERE sch.is_active = TRUE
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Verify
-- ─────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM trainers)        AS trainers,
  (SELECT count(*) FROM class_templates) AS templates,
  (SELECT count(*) FROM class_schedules) AS schedules,
  (SELECT count(*) FROM class_sessions)  AS sessions,
  (SELECT count(*) FROM members)         AS members;

SELECT 'Recovery patch complete' AS status;
