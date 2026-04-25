// models/sensorStore.js
// Keeps the latest reading in memory (for fast GET /api/sensor responses)
// and persists a time-series row to sensor_readings once per minute per plant.
const pool = require('../db');

let latestReading = { raw: null, moisture: null, pump: null, timestamp: null };

// Track last DB-write time per plant to throttle inserts to ~1/min
const lastSavedAt = {};

module.exports = {
  get: () => latestReading,

  set: (data, plantId = 1) => {
    latestReading = { ...data, timestamp: new Date().toISOString() };

    // Throttle: only persist to DB once per 60 s per plant
    const now = Date.now();
    if (!lastSavedAt[plantId] || now - lastSavedAt[plantId] >= 60_000) {
      lastSavedAt[plantId] = now;
      pool.query(
        'INSERT INTO sensor_readings (plant_id, raw_adc, moisture, pump) VALUES ($1,$2,$3,$4)',
        [plantId, data.raw ?? null, data.moisture, data.pump ?? false]
      ).catch(err => console.error('[sensorStore] insert failed:', err.message));
    }

    return latestReading;
  },
};
