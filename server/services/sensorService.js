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
    sensorStore.set({ raw, moisture, pump, timestamp: new Date().toISOString() });

    // updateSensorData uses a whitelist — config fields are safe
    plantStore.updateSensorData(1, {
      moisture,
      pump: pump ?? false,
      status: getMoistureStatus(moisture),
    });

    return sensorStore.get();
  },

  getLatest: () => sensorStore.get(),
};