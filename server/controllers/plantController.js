// controllers/plantController.js
const plantService = require('../services/plantService');
const plantStore   = require('../models/plantStore');

module.exports = {
  getAll: (req, res) => {
    res.json(plantService.getAllPlants());
  },

  getOne: (req, res) => {
    const plant = plantService.getPlant(req.params.id);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    res.json(plant);
  },

  // PATCH /api/plants/:id/config  <- ConfigureScreen save button
  updateConfig: (req, res) => {
    const updated = plantService.updateConfig(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Plant not found' });
    plantStore.logActivity(req.params.id, 'config_change', req.body);
    res.json(updated);
  },

  // GET /api/plants/profiles  <- ConfigureScreen plant type picker + preview
  getProfiles: (req, res) => {
    res.json(plantService.getProfiles());
  },

  // POST /api/plants/preview-params  <- live derived-params preview in configure screen
  // Body: { plantType, potSize, soilVolume, moistureThreshold, thresholdOverridden }
  previewParams: (req, res) => {
    const params = plantService.previewParams(req.body);
    res.json(params);
  },
};