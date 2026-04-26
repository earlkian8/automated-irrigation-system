// routes/analyticsRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/analyticsController');

// GET /api/analytics/summary
// Returns combined weekly water chart + per-plant stats from the DB.
router.get('/analytics/summary', ctrl.getSummary);

// GET /api/activity?limit=50
// Returns the latest activity log entries (excludes sensor_reading by default).
router.get('/activity', ctrl.getActivity);

module.exports = router;
