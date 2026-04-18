// Analytics constants
export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Plant health thresholds
export const HEALTH_THRESHOLDS = {
  healthy: 60,
  moderate: 30,
};

// Health categories
export const HEALTH_CATEGORIES = {
  healthy: { label: 'Healthy', minMoisture: 60 },
  moderate: { label: 'Moderate', minMoisture: 30, maxMoisture: 59 },
  critical: { label: 'Critical', maxMoisture: 29 },
};
