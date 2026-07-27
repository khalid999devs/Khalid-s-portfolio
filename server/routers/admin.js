const router = require('express').Router();
const {
  adminLogin,
  isAdminValidated,
  adminLogout,
} = require('../controllers/admin');
const adminValidate = require('../middlewares/adminTokenVerify');

// `POST /reg` used to live here, unauthenticated. Anyone could register a new
// username and receive a full administrator session, which in turn unlocked
// every other write route on this server. Administrator accounts are now
// created and rotated only from the machine running the database, via
// `npm run admin:bootstrap` / `npm run admin:rotate`.
//
// `GET /` (list all administrators) was also removed: no client code has ever
// called it, so it was attack surface with no purpose.
router.post('/login', adminLogin);
router.get('/logout', adminLogout);
router.get('/auth', adminValidate, isAdminValidated);

module.exports = router;
