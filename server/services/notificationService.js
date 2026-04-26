const { Expo } = require('expo-server-sdk');
const db = require('../db');
const plantStore = require('../models/plantStore');

const expo = new Expo();

// Map<`${plantId}:${alertType}`, timestampMs>
const cooldowns = new Map();
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

async function registerToken(token, platform) {
  await db.query(
    `INSERT INTO device_tokens (token, platform, last_seen)
     VALUES ($1, $2, NOW())
     ON CONFLICT (token) DO UPDATE SET last_seen = NOW()`,
    [token, platform ?? null]
  );
}

async function removeToken(token) {
  await db.query('DELETE FROM device_tokens WHERE token = $1', [token]);
}

async function getAllTokens() {
  const { rows } = await db.query('SELECT token FROM device_tokens');
  return rows.map(r => r.token);
}

async function sendNotification(title, body, data = {}) {
  let tokens;
  try {
    tokens = await getAllTokens();
  } catch (err) {
    console.error('[notifications] Failed to load tokens:', err.message);
    return;
  }

  if (tokens.length === 0) return;

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
    channelId: 'irrigation',
  }));

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    // Build index map so we can match tickets back to tokens
    const chunkTokens = chunk.map(m => m.to);
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'error') {
          console.warn('[notifications] Push error:', ticket.message);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            removeToken(chunkTokens[i]).catch(() => {});
          }
        }
      });
    } catch (err) {
      console.error('[notifications] Chunk send failed:', err.message);
    }
  }
}

function isOnCooldown(plantId, alertType) {
  const key = `${plantId}:${alertType}`;
  const last = cooldowns.get(key) ?? 0;
  return Date.now() - last < COOLDOWN_MS;
}

function setCooldown(plantId, alertType) {
  cooldowns.set(`${plantId}:${alertType}`, Date.now());
}

let dailyCronStarted = false;

function startDailySummaryCron() {
  if (dailyCronStarted) return;
  dailyCronStarted = true;

  setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() !== 8 || now.getUTCMinutes() !== 0) return;
    if (isOnCooldown(null, 'daily_summary')) return;

    setCooldown(null, 'daily_summary');

    const plants = plantStore.getAll();
    const healthy = plants.filter(p => p.moisture >= 50 && p.moisture < 75).length;
    const needsAttention = plants.length - healthy;

    const body = needsAttention === 0
      ? `All ${plants.length} plant${plants.length !== 1 ? 's' : ''} are healthy`
      : `${healthy} healthy, ${needsAttention} need${needsAttention !== 1 ? '' : 's'} attention`;

    sendNotification('Daily Plant Summary', body, { type: 'daily_summary' })
      .catch(err => console.error('[notifications] Daily summary failed:', err.message));
  }, 60_000);
}

module.exports = {
  registerToken,
  removeToken,
  sendNotification,
  isOnCooldown,
  setCooldown,
  startDailySummaryCron,
};
