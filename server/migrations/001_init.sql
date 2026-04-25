-- 001_init.sql
-- Run once against the Supabase database to set up all tables.

-- ── Plants ─────────────────────────────────────────────────────────────────────
-- Stores config and a snapshot of live telemetry for each plant.
-- The server keeps an in-memory copy for fast IoT polling; this table is the
-- persistent source of truth.

CREATE TABLE IF NOT EXISTS plants (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT    NOT NULL DEFAULT 'My Plant',

  -- User config
  plant_type            TEXT    NOT NULL DEFAULT 'Fern',
  pot_size              TEXT    NOT NULL DEFAULT 'Medium',
  soil_volume           INTEGER NOT NULL DEFAULT 500,
  irrigation_mode       TEXT    NOT NULL DEFAULT 'Hybrid',
  schedule_type         TEXT    NOT NULL DEFAULT 'Daily',
  schedule_days         INTEGER NOT NULL DEFAULT 1,
  schedule_time         TEXT    NOT NULL DEFAULT '08:00',
  threshold_overridden  BOOLEAN NOT NULL DEFAULT FALSE,
  hose_length_cm        INTEGER NOT NULL DEFAULT 0,
  hose_length_unit      TEXT    NOT NULL DEFAULT 'cm',

  -- Derived (server-computed from config)
  moisture_threshold    INTEGER,
  water_amount          INTEGER,
  pump_duration_ms      INTEGER,
  drain_time_sec        INTEGER,
  schedule_default_days INTEGER,

  -- Live telemetry snapshot (updated whenever ESP32 posts to /api/sensor)
  moisture              NUMERIC(5,2),
  temperature           NUMERIC(5,2),
  humidity              NUMERIC(5,2),
  pump                  BOOLEAN DEFAULT FALSE,
  status_label          TEXT,
  status_color          TEXT,

  -- Irrigation state
  manual_trigger        BOOLEAN     NOT NULL DEFAULT FALSE,
  last_watered          TIMESTAMPTZ,
  next_irrigation       TIMESTAMPTZ,
  last_scheduled_at     TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Water events ───────────────────────────────────────────────────────────────
-- One row per watering session. Analytics reads aggregate these.

CREATE TABLE IF NOT EXISTS water_events (
  id          SERIAL      PRIMARY KEY,
  plant_id    INTEGER     NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('manual', 'automatic')),
  amount_ml   INTEGER     NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS water_events_plant_time
  ON water_events (plant_id, occurred_at DESC);

-- ── Sensor readings ────────────────────────────────────────────────────────────
-- Time-series log of every sensor post from the ESP32.
-- Used for moisture history charts and analytics.
-- Throttled server-side to ~1 row per minute to avoid unbounded growth.

CREATE TABLE IF NOT EXISTS sensor_readings (
  id          SERIAL      PRIMARY KEY,
  plant_id    INTEGER     NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  raw_adc     INTEGER,
  moisture    NUMERIC(5,2) NOT NULL,
  pump        BOOLEAN     DEFAULT FALSE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sensor_readings_plant_time
  ON sensor_readings (plant_id, recorded_at DESC);

-- ── Seed a default plant (matches in-memory seed in plantStore.js) ──────────────
INSERT INTO plants (
  id, name,
  plant_type, pot_size, soil_volume, irrigation_mode,
  schedule_type, schedule_days, schedule_time,
  threshold_overridden, hose_length_cm, hose_length_unit,
  moisture_threshold, water_amount, pump_duration_ms, drain_time_sec, schedule_default_days,
  moisture, temperature, humidity, pump, status_label, status_color,
  manual_trigger
) VALUES (
  1, 'Fiddle Leaf Fig',
  'Fern', 'Medium', 500, 'Hybrid',
  'Daily', 1, '08:00',
  FALSE, 0, 'cm',
  50, 175, 3500, 10, 3,
  65, 22.5, 55, FALSE, 'Healthy', '#4DB6AC',
  FALSE
) ON CONFLICT (id) DO NOTHING;

-- Keep the serial sequence in sync after the manual insert
SELECT setval('plants_id_seq', GREATEST((SELECT MAX(id) FROM plants), 1));
