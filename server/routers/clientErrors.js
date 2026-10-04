const router = require('express').Router();
const {
  reportClientError,
  listClientErrors,
  clearClientErrors,
} = require('../controllers/clientErrors');
const adminValidate = require('../middlewares/adminTokenVerify');
const { clientErrorLimiter } = require('../middlewares/rateLimiters');

// Public, because the public site is what breaks. The limiter is on this route
// alone so an administrator reading the list is never throttled by it.
router.post('/', clientErrorLimiter, reportClientError);

// Reading and clearing the reports is admin only.
router.get('/', adminValidate, listClientErrors);
router.delete('/', adminValidate, clearClientErrors);

module.exports = router;
