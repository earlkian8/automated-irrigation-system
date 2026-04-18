const irrigationService = require('../services/irrigationService');
const plantStore        = require('../models/plantStore');

module.exports = {
  manualWater: (req, res) => {
    const { amount } = req.body;
    const result = irrigationService.triggerManualWater(req.params.id, amount);
    if (!result) return res.status(404).json({ error: 'Plant not found' });
    res.json(result);
  },

  updateSchedule: (req, res) => {
    const updated = irrigationService.updateSchedule(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Plant not found' });
    res.json(updated);
  },

  // Called by ESP32 immediately after it reads manualTrigger=true
  // Clears the flag so it doesn't re-fire on the next poll
  clearTrigger: (req, res) => {
    const plant = plantStore.getById(req.params.id);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    plantStore.setManualTrigger(req.params.id, false);
    console.log(`Manual trigger cleared for plant ${req.params.id}`);
    res.json({ ok: true });
  },
};