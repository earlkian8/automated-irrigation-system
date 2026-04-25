// routes/analyticsRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/analyticsController');

// GET /api/analytics/summary
// Returns combined weekly water chart + per-plant stats from the DB.
router.get('/analytics/summary', ctrl.getSummary);

module.exports = router;
