// controllers/analyticsController.js
const analyticsService = require('../services/analyticsService');
const pool             = require('../db');

module.exports = {
  getSummary: async (req, res) => {
    try {
      const summary = await analyticsService.getAnalyticsSummary();
      res.json(summary);
    } catch (err) {
      console.error('[analytics] getSummary failed:', err.message);
      res.status(500).json({ error: 'Analytics query failed' });
    }
  },

  getActivity: async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const { rows } = await pool.query(
        `SELECT * FROM activity_log
         WHERE event_type != 'sensor_reading'
         ORDER BY occurred_at DESC
         LIMIT $1`,
        [limit]
      );
      res.json(rows);
    } catch (err) {
      console.error('[analytics] getActivity failed:', err.message);
      res.status(500).json({ error: 'Activity query failed' });
    }
  },
};
