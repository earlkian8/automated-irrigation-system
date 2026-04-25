// models/plantStore.js
// Two responsibilities, never mixed:
//   updateSensorData -> only touches telemetry fields
//   updateConfig     -> only touches config/name, then recomputes derived params

const { deriveIrrigationParams } = require('./plantProfiles');

let nextHistoryId = 10;

// Telemetry fields the ESP32 is allowed to write — config is never touched here
const SENSOR_FIELDS = new Set(['moisture', 'temperature', 'humidity', 'status', 'pump']);

// Config fields the app is allowed to write
const ALLOWED_CONFIG = new Set([
  'plantType', 'potSize', 'soilVolume',
  'irrigationMode', 'scheduleType', 'scheduleDays',
  'scheduleTime', 'moistureThreshold', 'thresholdOverridden',
  'hoseLengthCm', 'hoseLengthUnit',
]);

const plants = [
  {
    id: 1,
    name: 'Fiddle Leaf Fig',
    manualTrigger: false,

    // Telemetry (ESP32 writes only)
    moisture: 65,
    temperature: 22.5,
    humidity: 55,
    pump: false,
    status: { color: '#4DB6AC', label: 'Healthy' },

    // History
    lastWatered: Date.now() - 3600000,
    nextIrrigation: Date.now() + 86400000,
    waterHistory: [
      { id: 1, type: 'manual',    timestamp: Date.now() - 3600000,  amount: 250 },
      { id: 2, type: 'automatic', timestamp: Date.now() - 86400000, amount: 300 },
    ],

    // Config (app writes only)
    // Derived fields are recomputed by recomputeDerived() on every save
    config: {
      plantType:           'Fern',
      potSize:             'Medium',
      soilVolume:          500,
      irrigationMode:      'Hybrid',
      scheduleType:        'Daily',
      scheduleDays:        1,
      scheduleTime:        '08:00',
      thresholdOverridden: false,
      // Derived (Fern + 500ml)
      moistureThreshold:   50,
      waterAmount:         175,
      pumpDurationMs:      3500,
      drainTimeSec:        10,
      scheduleDefaultDays: 3,
    },
  },
];

// Recompute profile-driven fields after any config change
function recomputeDerived(plant) {
  const params = deriveIrrigationParams(plant.config);
  plant.config.moistureThreshold   = params.moistureThreshold;
  plant.config.waterAmount         = params.waterAmount;
  plant.config.pumpDurationMs      = params.pumpDurationMs;
  plant.config.drainTimeSec        = params.drainTimeSec;
  plant.config.scheduleDefaultDays = params.scheduleDefaultDays;
}

const getAll = () => plants;

const getById = (id) => plants.find(p => p.id === parseInt(id));

// Sensor update: only whitelisted telemetry, never config
const updateSensorData = (id, data) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;
  const safe = {};
  for (const key of Object.keys(data)) {
    if (SENSOR_FIELDS.has(key)) safe[key] = data[key];
  }
  Object.assign(plant, safe);
  return plant;
};

// Config update: only whitelisted config fields, then re-derive
const updateConfig = (id, config, name) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;
  if (name !== undefined && name !== null) plant.name = name;
  for (const key of Object.keys(config)) {
    if (ALLOWED_CONFIG.has(key)) plant.config[key] = config[key];
  }
  recomputeDerived(plant);
  return plant;
};

const addWaterEvent = (id, type, amount) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;
  const event = { id: nextHistoryId++, type, timestamp: Date.now(), amount };
  plant.waterHistory.push(event);
  plant.lastWatered = Date.now();

  // Use the user-configured schedule interval, not the plant profile default
  let days = plant.config.scheduleDefaultDays ?? 1;
  if (plant.config.scheduleType === 'Every X Days') {
    days = plant.config.scheduleDays ?? days;
  } else if (plant.config.scheduleType === 'Daily') {
    days = 1;
  }
  plant.nextIrrigation = Date.now() + days * 24 * 3_600_000;
  return event;
};

const setManualTrigger = (id, value) => {
  const plant = plants.find(p => p.id === parseInt(id));
  if (!plant) return null;
  plant.manualTrigger = value;
  return plant;
};

module.exports = { getAll, getById, updateConfig, updateSensorData, addWaterEvent, setManualTrigger };