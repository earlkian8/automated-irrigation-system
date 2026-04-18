// routes/plantRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/plantController');

router.get('/plants/profiles',        ctrl.getProfiles);    // plant type catalogue
router.post('/plants/preview-params', ctrl.previewParams);  // live derived-params preview
router.get('/plants',                 ctrl.getAll);
router.get('/plants/:id',             ctrl.getOne);
router.patch('/plants/:id/config',    ctrl.updateConfig);

module.exports = router;