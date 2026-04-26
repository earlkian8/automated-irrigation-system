// services/irrigationService.js
const plantStore          = require('../models/plantStore');
const notificationService = require('./notificationService');

function getMoistureStatus(moisture) {
  if (moisture < 30) return { color: '#E57373', label: 'Dry' };
  if (moisture < 50) return { color: '#FFB74D', label: 'Needs Water' };
  if (moisture < 75) return { color: '#4DB6AC', label: 'Healthy' };
  return { color: '#AF97E5', label: 'Too Wet' };
}

module.exports = {
  triggerManualWater: (plantId, amountOverride) => {
    const plant = plantStore.getById(plantId);
    if (!plant) return null;

    const amount = amountOverride ?? plant.config.waterAmount ?? 150;

    const newMoisture = Math.min(100, (plant.moisture ?? 0) + 20);
    plantStore.updateSensorData(plantId, {
      moisture: newMoisture,
      status: getMoistureStatus(newMoisture),
    });

    // Set trigger BEFORE addWaterEvent so nothing can clear it in between
    plantStore.setManualTrigger(plantId, true);

    console.log('[irrigationService] manualTrigger set to:', plantStore.getById(plantId).manualTrigger);

    const event = plantStore.addWaterEvent(plantId, 'manual', amount);
    plantStore.logActivity(plantId, 'manual_irrigation', { amount });

    notificationService.sendNotification(
      'Manual Watering Started',
      `You watered ${plant.name} with ${amount}ml`,
      { type: 'manual_irrigation', plantId }
    );

    console.log('[irrigationService] manualTrigger after addWaterEvent:', plantStore.getById(plantId).manualTrigger);

    // Return the plant snapshot — do NOT call getById again after this,
    // the ESP32 may have already cleared the flag by the time we respond
    const snapshot = { ...plantStore.getById(plantId), manualTrigger: true };

    return { event, plant: snapshot };
  },

  updateSchedule: (plantId, scheduleConfig) =>
    plantStore.updateConfig(plantId, scheduleConfig),
};