const router = require('express').Router();
const { getStats } = require('../controllers/stats');
const adminValidate = require('../middlewares/adminTokenVerify');

// Admin only. These counts describe the shape of the site's private data,
// including how many messages have come in, which is nobody else's business.
router.get('/', adminValidate, getStats);

module.exports = router;
