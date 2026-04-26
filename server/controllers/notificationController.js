const { Expo } = require('expo-server-sdk');
const notificationService = require('../services/notificationService');

module.exports = {
  register: async (req, res) => {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({ error: 'invalid Expo push token format' });
    }
    try {
      await notificationService.registerToken(token, platform);
      res.json({ ok: true });
    } catch (err) {
      console.error('[notifications] register failed:', err.message);
      res.status(500).json({ error: 'Failed to register token' });
    }
  },

  unregister: async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    try {
      await notificationService.removeToken(token);
      res.json({ ok: true });
    } catch (err) {
      console.error('[notifications] unregister failed:', err.message);
      res.status(500).json({ error: 'Failed to unregister token' });
    }
  },
};
