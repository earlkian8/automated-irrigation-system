// services/sensorService.js
const sensorStore         = require('../models/sensorStore');
const plantStore          = require('../models/plantStore');
const notificationService = require('./notificationService');

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
        notificationService.sendNotification(
          'Auto Watering Started',
          `${plant.name} was automatically watered (moisture was ${moisture.toFixed(0)}%)`,
          { type: 'auto_irrigation', plantId: 1 }
        );
      }
    }

    // Pump just turned off — watering session complete
    if (!pump && prevPump && plant) {
      notificationService.sendNotification(
        'Watering Complete',
        `${plant.name} finished watering`,
        { type: 'watering_complete', plantId: 1 }
      );
    }

    // Log each sensor reading for the activity trail.
    // TODO: add a retention/pruning policy if this table grows too large (~43k rows/day at 2s interval).
    plantStore.logActivity(1, 'sensor_reading', { moisture, pump: pump ?? false });

    // Moisture-based smart alerts
    if (plant) {
      const threshold = plant.config.moistureThreshold ?? 50;

      if (moisture <= threshold + 15 && moisture > threshold) {
        if (!notificationService.isOnCooldown(1, 'low_moisture')) {
          notificationService.setCooldown(1, 'low_moisture');
          notificationService.sendNotification(
            'Getting Dry',
            `${plant.name} is at ${moisture.toFixed(0)}% moisture — consider watering soon`,
            { type: 'low_moisture', plantId: 1 }
          );
        }
      }

      if (moisture <= threshold && plant.config.irrigationMode === 'Manual') {
        if (!notificationService.isOnCooldown(1, 'critical_moisture')) {
          notificationService.setCooldown(1, 'critical_moisture');
          notificationService.sendNotification(
            'Needs Water Now',
            `${plant.name} is critically dry (${moisture.toFixed(0)}%) and needs manual watering`,
            { type: 'critical_moisture', plantId: 1 }
          );
        }
      }

      if (moisture > 75) {
        if (!notificationService.isOnCooldown(1, 'overwatered')) {
          notificationService.setCooldown(1, 'overwatered');
          notificationService.sendNotification(
            'Overwatering Alert',
            `${plant.name} moisture is very high (${moisture.toFixed(0)}%) — check drainage`,
            { type: 'overwatered', plantId: 1 }
          );
        }
      }
    }

    return sensorStore.get();
  },

  getLatest: () => sensorStore.get(),
};