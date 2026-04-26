// services/sensorService.js
const sensorStore = require('../models/sensorStore');
const plantStore  = require('../models/plantStore');

function getMoistureStatus(moisture) {
  if (moisture < 30) return { color: '#E57373', label: 'Dry' };
  if (moisture < 50) return { color: '#FFB74D', label: 'Needs Water' };
  if (moisture < 75) return { color: '#4DB6AC', label: 'Healthy' };
  return { color: '#AF97E5', label: 'Too Wet' };
}

module.exports = {
  // Called by ESP32 POST /api/sensor
  // Only telemetry fields are forwarded — config is never touched here.
  saveReading: ({ raw, moisture, pump }) => {
    const plant    = plantStore.getById(1);
    const prevPump = plant?.pump ?? false;

    sensorStore.set({ raw, moisture, pump, timestamp: new Date().toISOString() }, 1);

    // updateSensorData uses a whitelist — config fields are safe
    plantStore.updateSensorData(1, {
      moisture,
      pump: pump ?? false,
      status: getMoistureStatus(moisture),
    });

    // Detect ESP32-autonomous threshold-watering: pump just turned on but the
    // server didn't trigger this session. Server-triggered sessions call
    // addWaterEvent before the pump runs, so lastWatered will be very recent
    // (within pumpDurationMs + 30 s). If it's older than that, the ESP32 acted
    // on its own and we need to record the event ourselves.
    if (pump && !prevPump && plant) {
      const grace = (plant.config.pumpDurationMs ?? 3000) + 30_000;
      if (!plant.lastWatered || Date.now() - plant.lastWatered > grace) {
        plantStore.addWaterEvent(1, 'automatic', plant.config.waterAmount ?? 150);
        plantStore.logActivity(1, 'auto_irrigation', { source: 'esp32_threshold', moisture });
      }
    }

    // Log each sensor reading for the activity trail.
    // TODO: add a retention/pruning policy if this table grows too large (~43k rows/day at 2s interval).
    plantStore.logActivity(1, 'sensor_reading', { moisture, pump: pump ?? false });

    return sensorStore.get();
  },

  getLatest: () => sensorStore.get(),
};