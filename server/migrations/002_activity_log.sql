-- 002_activity_log.sql
-- Run once against the Supabase database to add the activity log table.

CREATE TABLE IF NOT EXISTS activity_log (
  id          SERIAL      PRIMARY KEY,
  plant_id    INTEGER     REFERENCES plants(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  details     TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_time
  ON activity_log (occurred_at DESC);
