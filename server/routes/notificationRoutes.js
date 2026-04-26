const express = require('express');
const ctrl    = require('../controllers/notificationController');

const router = express.Router();

router.post('/notifications/register',   ctrl.register);
router.delete('/notifications/register', ctrl.unregister);

module.exports = router;
