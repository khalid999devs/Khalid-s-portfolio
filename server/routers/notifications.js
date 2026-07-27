const router = require('express').Router();
const { getNotifications } = require('../controllers/notifications');
const adminValidate = require('../middlewares/adminTokenVerify');

// Admin only. These describe how the deployment is configured, including which
// features are unavailable and why, which is a useful map for an attacker and
// no use at all to a visitor.
router.get('/', adminValidate, getNotifications);

module.exports = router;
