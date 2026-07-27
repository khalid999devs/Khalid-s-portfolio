const router = require('express').Router();
const { trackVisit, getVisitStats, updateRetention } = require('../controllers/visits');
const adminValidate = require('../middlewares/adminTokenVerify');

// Public, because the public site is what generates the views. Nothing
// identifying is accepted or stored, so this is not a data collection endpoint
// in any meaningful sense; see utils/visitTracker.js.
router.post('/', trackVisit);

// Reading the numbers is admin only.
router.get('/stats', adminValidate, getVisitStats);
router.patch('/retention', adminValidate, updateRetention);

module.exports = router;
