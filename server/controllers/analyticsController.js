// controllers/analyticsController.js
const analyticsService = require('../services/analyticsService');

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
};
