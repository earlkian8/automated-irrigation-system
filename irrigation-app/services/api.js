// services/api.js
export const BASE_URL = 'https://urchin-app-idc22.ondigitalocean.app';

// Plants
export const fetchAllPlants = async () => {
  const res = await fetch(`${BASE_URL}/api/plants`);
  if (!res.ok) throw new Error('Failed to fetch plants');
  return res.json();
};

export const fetchPlantById = async (id) => {
  const res = await fetch(`${BASE_URL}/api/plants/${id}`);
  if (!res.ok) throw new Error('Failed to fetch plant');
  return res.json();
};

// Config save
export const saveConfig = async (id, config) => {
  const res = await fetch(`${BASE_URL}/api/plants/${id}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save config');
  return res.json();
};

// Plant profiles catalogue (descriptions + thresholds for all plant types)
export const fetchPlantProfiles = async () => {
  const res = await fetch(`${BASE_URL}/api/plants/profiles`);
  if (!res.ok) throw new Error('Failed to fetch profiles');
  return res.json();
};

// Live preview of derived params before saving
export const previewIrrigationParams = async (config) => {
  const res = await fetch(`${BASE_URL}/api/plants/preview-params`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to preview params');
  return res.json();
};

// Analytics summary (DB-backed: weekly water, health, moisture history)
export const fetchAnalyticsSummary = async () => {
  const res = await fetch(`${BASE_URL}/api/analytics/summary`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
};

// Manual water trigger
export const triggerManualWater = async (id, amount) => {
  const res = await fetch(`${BASE_URL}/api/plants/${id}/water`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error('Failed to trigger watering');
  return res.json();
};

// Activity log (excludes noisy sensor_reading entries)
export const fetchActivityLog = async (limit = 50) => {
  const res = await fetch(`${BASE_URL}/api/activity?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch activity log');
  return res.json();
};

