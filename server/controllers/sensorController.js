// controllers/sensorController.js
const sensorService = require('../services/sensorService');

module.exports = {
  receive: (req, res) => {
    const { raw, moisture, pump } = req.body;
    if (moisture === undefined) {
      return res.status(400).json({ error: 'moisture required' });
    }
    const reading = sensorService.saveReading({ raw, moisture, pump });
    console.log('Sensor reading:', reading);
    res.json({ status: 'ok', reading });
  },

  getLatest: (req, res) => {
    res.json(sensorService.getLatest());
  },
};