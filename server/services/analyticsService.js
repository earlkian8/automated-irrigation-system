// services/analyticsService.js
// All queries run against the DB — this is intentional.
// Analytics data doesn't need real-time in-memory speed; accuracy matters more.
const pool = require('../db');

/**
 * Returns total ml watered per day for the last 7 days (Mon–Sun aligned to today).
 * Result is an array of 7 numbers indexed Mon=0 … Sun=6.
 */
async function weeklyWaterUsage(plantId) {
  const { rows } = await pool.query(
    `SELECT
       EXTRACT(DOW FROM occurred_at AT TIME ZONE 'UTC') AS dow,
       SUM(amount_ml) AS total_ml
     FROM water_events
     WHERE plant_id = $1
       AND occurred_at >= NOW() - INTERVAL '7 days'
     GROUP BY dow
     ORDER BY dow`,
    [plantId]
  );

  // DOW: 0=Sun,1=Mon,...,6=Sat — remap to Mon=0…Sun=6
  const buckets = Array(7).fill(0);
  for (const row of rows) {
    const dow  = parseInt(row.dow);        // 0=Sun
    const idx  = dow === 0 ? 6 : dow - 1; // Mon=0, Sun=6
    buckets[idx] = parseInt(row.total_ml) || 0;
  }
  return buckets;
}

/**
 * Returns total ml watered across all time for a plant.
 */
async function totalWaterUsed(plantId) {
  const { rows } = await pool.query(
    'SELECT COALESCE(SUM(amount_ml), 0)::int AS total FROM water_events WHERE plant_id = $1',
    [plantId]
  );
  return rows[0]?.total ?? 0;
}

/**
 * Returns the number of watering sessions in the last 7 days.
 */
async function weeklyWateringCount(plantId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM water_events
     WHERE plant_id = $1 AND occurred_at >= NOW() - INTERVAL '7 days'`,
    [plantId]
  );
  return rows[0]?.cnt ?? 0;
}

/**
 * Returns average moisture per hour over the last 24 hours.
 * Shape: [{ hour: 'HH:00', moisture: number }, ...]
 */
async function moistureHistory24h(plantId) {
  const { rows } = await pool.query(
    `SELECT
       TO_CHAR(DATE_TRUNC('hour', recorded_at AT TIME ZONE 'UTC'), 'HH24:00') AS hour,
       ROUND(AVG(moisture)::numeric, 1) AS moisture
     FROM sensor_readings
     WHERE plant_id = $1
       AND recorded_at >= NOW() - INTERVAL '24 hours'
     GROUP BY DATE_TRUNC('hour', recorded_at AT TIME ZONE 'UTC')
     ORDER BY DATE_TRUNC('hour', recorded_at AT TIME ZONE 'UTC')`,
    [plantId]
  );
  return rows.map(r => ({ hour: r.hour, moisture: parseFloat(r.moisture) }));
}

/**
 * Full analytics summary for the analytics screen.
 * Includes data for ALL plants so the app can render a combined view.
 */
async function getAnalyticsSummary() {
  const { rows: plantRows } = await pool.query('SELECT id FROM plants ORDER BY id');

  const results = await Promise.all(
    plantRows.map(async ({ id }) => ({
      plantId:        id,
      weeklyWater:    await weeklyWaterUsage(id),
      totalWaterUsed: await totalWaterUsed(id),
      weeklyCount:    await weeklyWateringCount(id),
      moistureHistory:await moistureHistory24h(id),
    }))
  );

  // Aggregate weekly water across all plants for the chart
  const combinedWeekly = Array(7).fill(0);
  for (const r of results) {
    r.weeklyWater.forEach((v, i) => { combinedWeekly[i] += v; });
  }

  return { perPlant: results, combinedWeeklyWater: combinedWeekly };
}

module.exports = { getAnalyticsSummary, weeklyWaterUsage, totalWaterUsed, weeklyWateringCount, moistureHistory24h };
