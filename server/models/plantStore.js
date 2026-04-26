// models/plantStore.js
// Write-through memory cache backed by PostgreSQL.
//
// Reads always come from the in-memory store (fast for IoT polling every 2 s).
// Every mutation writes through to the DB asynchronously so nothing is lost
// if the server restarts.

const pool = require('../db');
const { deriveIrrigationParams } = require('./plantProfiles');

// ── In-memory cache ───────────────────────────────────────────────────────────
let plants     = [];          // loaded from DB on startup via initFromDB()
let nextHistoryId = 100;      // kept in-memory; water_events are the real source

// Telemetry fields the ESP32 is allowed to overwrite (never touches config)
const SENSOR_FIELDS = new Set(['moisture', 'temperature', 'humidity', 'status', 'pump']);

// Config fields the app is allowed to write
const ALLOWED_CONFIG = new Set([
  'plantType', 'potSize', 'soilVolume',
  'irrigationMode', 'scheduleType', 'scheduleDays',
  'scheduleTime', 'moistureThreshold', 'thresholdOverridden',
  'hoseLengthCm', 'hoseLengthUnit',
]);

// ── DB helpers ────────────────────────────────────────────────────────────────

// Row from DB → in-memory plant object
function rowToPlant(row, events = []) {
  return {
    id:             row.id,
    name:           row.name,
    manualTrigger:  row.manual_trigger,
    moisture:       row.moisture != null ? parseFloat(row.moisture) : null,
    temperature:    row.temperature != null ? parseFloat(row.temperature) : null,
    humidity:       row.humidity != null ? parseFloat(row.humidity) : null,
    pump:           row.pump,
    status:         { color: row.status_color, label: row.status_label },
    lastWatered:    row.last_watered ? new Date(row.last_watered).getTime() : null,
    nextIrrigation: row.next_irrigation ? new Date(row.next_irrigation).getTime() : null,
    lastScheduledAt:row.last_scheduled_at ? new Date(row.last_scheduled_at).getTime() : null,
    waterHistory:   events,
    config: {
      plantType:           row.plant_type,
      potSize:             row.pot_size,
      soilVolume:          row.soil_volume,
      irrigationMode:      row.irrigation_mode,
      scheduleType:        row.schedule_type,
      scheduleDays:        row.schedule_days,
      scheduleTime:        row.schedule_time,
      thresholdOverridden: row.threshold_overridden,
      hoseLengthCm:        row.hose_length_cm,
      hoseLengthUnit:      row.hose_length_unit,
      moistureThreshold:   row.moisture_threshold,
      waterAmount:         row.water_amount,
      pumpDurationMs:      row.pump_duration_ms,
      drainTimeSec:        row.drain_time_sec,
      scheduleDefaultDays: row.schedule_default_days,
    },
  };
}

// ── Startup: hydrate memory from DB ──────────────────────────────────────────
async function initFromDB() {
  try {
    const { rows: plantRows } = await pool.query('SELECT * FROM plants ORDER BY id');
    const { rows: eventRows } = await pool.query(
      'SELECT * FROM water_events ORDER BY occurred_at ASC'
    );

    plants = plantRows.map(row => {
      const events = eventRows
        .filter(e => e.plant_id === row.id)
        .map(e => ({
          id:        e.id,
          type:      e.type,
          timestamp: new Date(e.occurred_at).getTime(),
          amount:    e.amount_ml,
        }));
      return rowToPlant(row, events);
    });

    // Sync nextHistoryId
    const maxId = eventRows.reduce((m, e) => Math.max(m, e.id), 0);
    nextHistoryId = maxId + 1;

    console.log(`[plantStore] loaded ${plants.length} plant(s) from DB`);
  } catch (err) {
    console.error('[plantStore] DB init failed — using empty store:', err.message);
  }
}

// ── Async DB writes (fire-and-forget, failures are logged not thrown) ─────────
function persistConfig(plant) {
  const c = plant.config;
  pool.query(
    `UPDATE plants SET
       name=$1, plant_type=$2, pot_size=$3, soil_volume=$4,
       irrigation_mode=$5, schedule_type=$6, schedule_days=$7, schedule_time=$8,
       threshold_overridden=$9, hose_length_cm=$10, hose_length_unit=$11,
       moisture_threshold=$12, water_amount=$13, pump_duration_ms=$14,
       drain_time_sec=$15, schedule_default_days=$16, updated_at=NOW()
     WHERE id=$17`,
    [
      plant.name, c.plantType, c.potSize, c.soilVolume,
      c.irrigationMode, c.scheduleType, c.scheduleDays, c.scheduleTime,
      c.thresholdOverridden, c.hoseLengthCm, c.hoseLengthUnit,
      c.moistureThreshold, c.waterAmount, c.pumpDurationMs,
      c.drainTimeSec, c.scheduleDefaultDays, plant.id,
    ]
  ).catch(err => console.error('[plantStore] persistConfig failed:', err.message));
}

function persistTelemetry(plant) {
  pool.query(
    `UPDATE plants SET
       moisture=$1, temperature=$2, humidity=$3, pump=$4,
       status_label=$5, status_color=$6, updated_at=NOW()
     WHERE id=$7`,
    [
      plant.moisture, plant.temperature, plant.humidity, plant.pump,
      plant.status?.label, plant.status?.color, plant.id,
    ]
  ).catch(err => console.error('[plantStore] persistTelemetry failed:', err.message));
}

function persistState(plant) {
  pool.query(
    `UPDATE plants SET
       manual_trigger=$1, last_watered=$2, next_irrigation=$3,
       last_scheduled_at=$4, updated_at=NOW()
     WHERE id=$5`,
    [
      plant.manualTrigger,
      plant.lastWatered    ? new Date(plant.lastWatered)    : null,
      plant.nextIrrigation ? new Date(plant.nextIrrigation) : null,
      plant.lastScheduledAt ? new Date(plant.lastScheduledAt) : null,
      plant.id,
    ]
  ).catch(err => console.error('[plantStore] persistState failed:', err.message));
}

// ── Recompute derived config after any config change ──────────────────────────
function recomputeDerived(plant) {
  const params = deriveIrrigationParams(plant.config);
  plant.config.moistureThreshold   = params.moistureThreshold;
  plant.config.waterAmount         = params.waterAmount;
  plant.config.pumpDurationMs      = params.pumpDurationMs;
  plant.config.drainTimeSec        = params.drainTimeSec;
  plant.config.scheduleDefaultDays = params.scheduleDefaultDays;
}

// ── Public API ────────────────────────────────────────────────────────────────
const getAll  = () => plants;
const getById = (id) => plants.find(p => p.id === parseInt(id));

const updateSensorData = (id, data) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;
  const safe = {};
  for (const key of Object.keys(data)) {
    if (SENSOR_FIELDS.has(key)) safe[key] = data[key];
  }
  Object.assign(plant, safe);
  persistTelemetry(plant);
  return plant;
};

const updateConfig = (id, config, name) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;
  if (name !== undefined && name !== null) plant.name = name;
  for (const key of Object.keys(config)) {
    if (ALLOWED_CONFIG.has(key)) plant.config[key] = config[key];
  }
  recomputeDerived(plant);
  persistConfig(plant);
  return plant;
};

const addWaterEvent = (id, type, amount) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;

  // In-memory event (id is temporary — real ID comes from DB)
  const event = { id: nextHistoryId++, type, timestamp: Date.now(), amount };
  plant.waterHistory.push(event);
  plant.lastWatered = Date.now();

  let days = plant.config.scheduleDefaultDays ?? 1;
  if (plant.config.scheduleType === 'Every X Days') {
    days = plant.config.scheduleDays ?? days;
  } else if (plant.config.scheduleType === 'Daily') {
    days = 1;
  }
  plant.nextIrrigation = Date.now() + days * 24 * 3_600_000;

  // Persist to DB
  pool.query(
    'INSERT INTO water_events (plant_id, type, amount_ml, occurred_at) VALUES ($1,$2,$3,$4)',
    [plant.id, type, amount, new Date(event.timestamp)]
  ).catch(err => console.error('[plantStore] addWaterEvent insert failed:', err.message));

  persistState(plant);
  return event;
};

const setManualTrigger = (id, value) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;
  plant.manualTrigger = value;
  persistState(plant);
  return plant;
};

const logActivity = (plantId, eventType, details = '') => {
  pool.query(
    'INSERT INTO activity_log (plant_id, event_type, details, occurred_at) VALUES ($1,$2,$3,NOW())',
    [
      plantId != null ? parseInt(plantId) : null,
      eventType,
      typeof details === 'object' ? JSON.stringify(details) : details,
    ]
  ).catch(err => console.error('[plantStore] logActivity failed:', err.message));
};

module.exports = {
  initFromDB,
  getAll,
  getById,
  updateConfig,
  updateSensorData,
  addWaterEvent,
  setManualTrigger,
  logActivity,
};
