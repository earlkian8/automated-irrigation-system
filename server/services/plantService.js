// services/plantService.js
const plantStore    = require('../models/plantStore');
const { PLANT_PROFILES, deriveIrrigationParams } = require('../models/plantProfiles');

module.exports = {
  getAllPlants: () => plantStore.getAll(),

  getPlant: (id) => plantStore.getById(id),

  // Called by PATCH /api/plants/:id/config from ConfigureScreen.
  // Saves config, recomputeDerived fires inside plantStore.updateConfig.
  updateConfig: (id, { name, ...config }) =>
    plantStore.updateConfig(id, config, name),

  // Returns live preview of derived params for a hypothetical config.
  // Used by the app's configure screen to show "smart defaults" before saving.
  previewParams: (config) => deriveIrrigationParams(config),

  // Returns the full plant profiles catalogue for the configure screen picker.
  getProfiles: () => PLANT_PROFILES,
};