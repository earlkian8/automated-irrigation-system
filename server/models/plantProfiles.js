// models/plantProfiles.js
// ─────────────────────────────────────────────────────────────────────────────
// Source of truth for every plant-type-driven irrigation decision.
//
// moistureThreshold  – water when soil moisture drops below this %
// waterFraction      – ml of water per ml of soil volume per session
//                      e.g. 0.25 on a 500 ml pot → 125 ml per session
// minWaterAmount     – floor so tiny pots still get a real dose (ml)
// maxWaterAmount     – ceiling to prevent flooding (ml)
// drainTimeSec       – seconds to wait after pump off before re-reading moisture
//                      (avoids false "still dry" reads while water is soaking in)
// scheduleDefaultDays – suggested watering interval for schedule mode
// description        – shown in the app's configure screen
// ─────────────────────────────────────────────────────────────────────────────

const PLANT_PROFILES = {
  'Cactus': {
    moistureThreshold:   15,
    waterFraction:       0.15,
    minWaterAmount:      30,
    maxWaterAmount:      150,
    drainTimeSec:        30,
    scheduleDefaultDays: 14,
    description:         'Drought-adapted. Water sparingly; let soil fully dry between sessions.',
  },
  'Succulent': {
    moistureThreshold:   15,
    waterFraction:       0.15,
    minWaterAmount:      30,
    maxWaterAmount:      150,
    drainTimeSec:        30,
    scheduleDefaultDays: 14,
    description:         'Stores water in leaves. Overwatering is the #1 killer.',
  },
  'Aloe Vera': {
    moistureThreshold:   20,
    waterFraction:       0.18,
    minWaterAmount:      40,
    maxWaterAmount:      200,
    drainTimeSec:        30,
    scheduleDefaultDays: 10,
    description:         'Low water needs. Prefers dry soil between watering.',
  },
  'Snake Plant': {
    moistureThreshold:   25,
    waterFraction:       0.20,
    minWaterAmount:      50,
    maxWaterAmount:      250,
    drainTimeSec:        20,
    scheduleDefaultDays: 10,
    description:         'Very tolerant of neglect and dry conditions.',
  },
  'Orchid': {
    moistureThreshold:   35,
    waterFraction:       0.22,
    minWaterAmount:      60,
    maxWaterAmount:      200,
    drainTimeSec:        20,
    scheduleDefaultDays: 7,
    description:         'Needs dry periods between watering. Sensitive to overwatering.',
  },
  'Spider Plant': {
    moistureThreshold:   40,
    waterFraction:       0.25,
    minWaterAmount:      80,
    maxWaterAmount:      400,
    drainTimeSec:        15,
    scheduleDefaultDays: 5,
    description:         'Adaptable. Prefers evenly moist soil.',
  },
  'Pothos': {
    moistureThreshold:   40,
    waterFraction:       0.25,
    minWaterAmount:      80,
    maxWaterAmount:      400,
    drainTimeSec:        15,
    scheduleDefaultDays: 5,
    description:         'Tolerates dry spells but thrives with consistent moisture.',
  },
  'Monstera': {
    moistureThreshold:   40,
    waterFraction:       0.28,
    minWaterAmount:      100,
    maxWaterAmount:      600,
    drainTimeSec:        15,
    scheduleDefaultDays: 5,
    description:         'Tropical. Likes moist but well-draining soil.',
  },
  'Peace Lily': {
    moistureThreshold:   45,
    waterFraction:       0.30,
    minWaterAmount:      100,
    maxWaterAmount:      500,
    drainTimeSec:        10,
    scheduleDefaultDays: 4,
    description:         'Visibly wilts when thirsty. Needs consistent moisture.',
  },
  'Fern': {
    moistureThreshold:   50,
    waterFraction:       0.35,
    minWaterAmount:      120,
    maxWaterAmount:      600,
    drainTimeSec:        10,
    scheduleDefaultDays: 3,
    description:         'Hates drying out. Keep soil near-constantly moist.',
  },
};

// Pot size → typical soil volume in ml (used when soilVolume is not set manually)
const POT_SIZE_DEFAULTS = {
  'Small':  300,
  'Medium': 500,
  'Large':  1000,
};

// Pump flow rate — calibrate this to your actual pump (ml per second)
const PUMP_FLOW_RATE_ML_PER_SEC =17;

// Assumed inner diameter of standard drip irrigation tubing (mm)
// Most indoor drip tubes are 4–8 mm; 6 mm is a common middle-ground default.
const HOSE_INNER_DIAMETER_MM = 6;

/**
 * Returns the profile for a given plant type.
 * Falls back to a safe "medium needs" default if type is unknown.
 */
function getProfile(plantType) {
  return PLANT_PROFILES[plantType] ?? {
    moistureThreshold:   35,
    waterFraction:       0.25,
    minWaterAmount:      80,
    maxWaterAmount:      400,
    drainTimeSec:        15,
    scheduleDefaultDays: 7,
    description:         'Generic profile.',
  };
}

/**
 * Derives all irrigation parameters from plant config.
 *
 * Returns:
 *   moistureThreshold  – % below which watering triggers
 *   waterAmount        – ml to dispense this session
 *   pumpDurationMs     – how long to run the relay (milliseconds)
 *   drainTimeSec       – seconds before re-reading moisture post-water
 *   scheduleDefaultDays
 *   profile            – full profile object
 */
function deriveIrrigationParams(config) {
  const profile    = getProfile(config.plantType);
  const soilVolume = config.soilVolume
    ?? POT_SIZE_DEFAULTS[config.potSize]
    ?? 500;

  // If the user manually set a threshold, respect it; otherwise use the profile default
  const moistureThreshold = config.thresholdOverridden
    ? config.moistureThreshold
    : profile.moistureThreshold;

  // Water amount: fraction of soil volume, clamped to min/max
  const rawAmount  = Math.round(soilVolume * profile.waterFraction);
  const waterAmount = Math.min(
    profile.maxWaterAmount,
    Math.max(profile.minWaterAmount, rawAmount)
  );

  // Hose dead volume: the water that fills the tube before any reaches the plant.
  // Volume = π × r² × length  (cm units throughout → result in ml, since 1 cm³ = 1 ml)
  const hoseLengthCm   = config.hoseLengthCm ?? 0;
  const hoseRadiusCm   = (HOSE_INNER_DIAMETER_MM / 10) / 2;
  const hoseDeadVolumeMl = Math.round(Math.PI * hoseRadiusCm * hoseRadiusCm * hoseLengthCm);

  // Pump must push waterAmount to the plant PLUS fill the hose dead volume first
  const pumpDurationMs = Math.round(
    ((waterAmount + hoseDeadVolumeMl) / PUMP_FLOW_RATE_ML_PER_SEC) * 1000
  );

  return {
    moistureThreshold,
    waterAmount,
    hoseDeadVolumeMl,
    pumpDurationMs,
    drainTimeSec:        profile.drainTimeSec,
    scheduleDefaultDays: profile.scheduleDefaultDays,
    profile,
  };
}

module.exports = {
  PLANT_PROFILES,
  POT_SIZE_DEFAULTS,
  PUMP_FLOW_RATE_ML_PER_SEC,
  HOSE_INNER_DIAMETER_MM,
  getProfile,
  deriveIrrigationParams,
};