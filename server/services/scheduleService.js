// services/scheduleService.js
// Fires scheduled irrigations server-side so the ESP32 only needs to poll for
// manualTrigger — no time logic lives on the device.
const plantStore          = require('../models/plantStore');
const notificationService = require('./notificationService');

function startScheduler() {
  setInterval(tick, 60_000);
  console.log('[scheduler] started — checking schedules every 60 s');
}

function tick() {
  const now  = new Date();
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  for (const plant of plantStore.getAll()) {
    const cfg = plant.config;

    // Only auto-schedule in modes that support automatic watering
    if (!['Automatic', 'Hybrid'].includes(cfg.irrigationMode)) continue;

    // Must match the configured watering time (UTC HH:MM)
    if (cfg.scheduleTime !== hhmm) continue;

    // Enforce the schedule interval so we don't water more often than configured
    const minIntervalMs =
      (cfg.scheduleType === 'Every X Days' ? (cfg.scheduleDays ?? 1) : 1) * 86_400_000;
    if (Date.now() - (plant.lastWatered ?? 0) < minIntervalMs) continue;

    // Guard against double-firing within the same minute (e.g. server restart)
    if (plant.lastScheduledAt && Date.now() - plant.lastScheduledAt < 60_000) continue;

    plant.lastScheduledAt = Date.now();
    plantStore.setManualTrigger(plant.id, true);
    plantStore.addWaterEvent(plant.id, 'automatic', cfg.waterAmount ?? 150);
    plantStore.logActivity(plant.id, 'scheduled_irrigation', { scheduleTime: hhmm, amount: cfg.waterAmount ?? 150 });
    notificationService.sendNotification(
      'Scheduled Watering',
      `${plant.name} received its scheduled watering`,
      { type: 'scheduled_irrigation', plantId: plant.id }
    );
    console.log(`[scheduler] plant ${plant.id} ("${plant.name}") triggered at UTC ${hhmm}`);
  }

  // 30-minute schedule reminder
  for (const plant of plantStore.getAll()) {
    if (!plant.nextIrrigation) continue;
    const minutesUntil = (new Date(plant.nextIrrigation) - Date.now()) / 60_000;
    if (minutesUntil >= 28 && minutesUntil <= 32) {
      if (!notificationService.isOnCooldown(plant.id, 'schedule_reminder')) {
        notificationService.setCooldown(plant.id, 'schedule_reminder');
        notificationService.sendNotification(
          'Watering Soon',
          `${plant.name} is scheduled to water in 30 minutes`,
          { type: 'schedule_reminder', plantId: plant.id }
        );
      }
    }
  }
}

module.exports = { startScheduler };
