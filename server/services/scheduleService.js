// services/scheduleService.js
// Fires scheduled irrigations server-side so the ESP32 only needs to poll for
// manualTrigger — no time logic lives on the device.
const plantStore          = require('../models/plantStore');
const notificationService = require('./notificationService');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function tryParse(str) {
  try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return null; }
}

function fireIrrigation(plant, cfg, details) {
  plant.lastScheduledAt = Date.now();
  plantStore.setManualTrigger(plant.id, true);
  plantStore.addWaterEvent(plant.id, 'automatic', cfg.waterAmount ?? 150);
  plantStore.logActivity(plant.id, 'scheduled_irrigation', details);
  notificationService.sendNotification(
    'Scheduled Watering',
    `${plant.name} received its scheduled watering`,
    { type: 'scheduled_irrigation', plantId: plant.id }
  );
}

function handleCustomSchedule(plant, cfg, now) {
  const cc = tryParse(cfg.customConfig);
  if (!cc) return;

  // ── Quick Fire: one-shot demo trigger ──────────────────────────────────────
  if (cc.mode === 'quick_fire' && cc.triggerAt) {
    if (Date.now() < new Date(cc.triggerAt).getTime()) return; // not yet
    if (plant.lastScheduledAt && Date.now() - plant.lastScheduledAt < 60_000) return;

    console.log(`[scheduler] Quick Fire triggered for "${plant.name}" (delay was ${cc.delayMinutes} min)`);
    fireIrrigation(plant, cfg, { source: 'custom_quick_fire', delayMinutes: cc.delayMinutes });

    // Clear triggerAt so it never fires again
    const cleared = JSON.stringify({ ...cc, triggerAt: null });
    plantStore.updateConfig(plant.id, { customConfig: cleared });

    notificationService.sendNotification(
      'Demo Watering Fired',
      `${plant.name} quick-fire triggered after ${cc.delayMinutes} min`,
      { type: 'custom_quick_fire', plantId: plant.id }
    );
    return;
  }

  // ── Days of Week: water on specific days at the configured time ────────────
  if (cc.mode === 'days_of_week' && Array.isArray(cc.days) && cc.days.length > 0) {
    const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    if (!cc.days.includes(now.getUTCDay())) return;    // wrong day
    if (cfg.scheduleTime !== hhmm) return;              // wrong time
    if (plant.lastScheduledAt && Date.now() - plant.lastScheduledAt < 60_000) return;
    // Prevent double-firing on the same day (6-hour guard)
    if (Date.now() - (plant.lastWatered ?? 0) < 6 * 3_600_000) return;

    const dayName = DAY_NAMES[now.getUTCDay()];
    console.log(`[scheduler] Days-of-week triggered for "${plant.name}" on ${dayName}`);
    fireIrrigation(plant, cfg, { source: 'custom_days_of_week', day: dayName, time: hhmm });
  }
}

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

    // Custom schedule type has its own logic
    if (cfg.scheduleType === 'Custom') {
      handleCustomSchedule(plant, cfg, now);
      continue;
    }

    // ── Daily / Every X Days ─────────────────────────────────────────────────

    // Must match the configured watering time (UTC HH:MM)
    if (cfg.scheduleTime !== hhmm) continue;

    // Enforce the schedule interval so we don't water more often than configured
    const minIntervalMs =
      (cfg.scheduleType === 'Every X Days' ? (cfg.scheduleDays ?? 1) : 1) * 86_400_000;
    if (Date.now() - (plant.lastWatered ?? 0) < minIntervalMs) continue;

    // Guard against double-firing within the same minute (e.g. server restart)
    if (plant.lastScheduledAt && Date.now() - plant.lastScheduledAt < 60_000) continue;

    fireIrrigation(plant, cfg, { scheduleTime: hhmm, amount: cfg.waterAmount ?? 150 });
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
