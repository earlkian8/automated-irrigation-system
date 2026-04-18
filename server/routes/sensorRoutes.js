const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sensorController');

router.post('/sensor', ctrl.receive);   // ESP32 posts here
router.get('/sensor', ctrl.getLatest);  // App polls here

module.exports = router;