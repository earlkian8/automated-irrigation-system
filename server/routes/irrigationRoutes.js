const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/irrigationController');

router.post('/plants/:id/water',         ctrl.manualWater);
router.patch('/plants/:id/schedule',     ctrl.updateSchedule);
router.post('/plants/:id/clear-trigger', ctrl.clearTrigger);

module.exports = router;