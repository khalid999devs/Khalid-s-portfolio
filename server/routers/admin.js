const router = require('express').Router();
const {
  adminLogin,
  isAdminValidated,
  adminLogout,
  listAdmins,
  changeOwnPassword,
  createAdmin,
  removeAdmin,
} = require('../controllers/admin');
const adminValidate = require('../middlewares/adminTokenVerify');
const { adminAccountLimiter } = require('../middlewares/rateLimiters');

// `POST /reg` used to live here, unauthenticated. Anyone could register a
// username and receive a full administrator session, which in turn unlocked
// every other write route on this server. It is gone for good.
//
// Account management is back below, on completely different terms: every one of
// those routes requires an existing administrator session AND that
// administrator's own password. A stolen session cookie alone therefore cannot
// add a second, quieter way in, or change the password out from under the
// owner.
//
// `npm run admin:bootstrap` is still the only way to create the first account,
// because on an empty database there is no session to authenticate against.
router.post('/login', adminLogin);
router.get('/logout', adminLogout);
router.get('/auth', adminValidate, isAdminValidated);

// `GET /accounts` replaces the old public `GET /`, which listed every username
// to anyone who asked. This one is authenticated and never selects the hash.
router.get('/accounts', adminValidate, listAdmins);

// Rate limited on their own bucket, not the login one. Each verifies a
// password, so they are password oracles if left unthrottled, but sharing the
// login counter would let anyone who can reach /login exhaust it and lock the
// real administrator out of changing their own password.
router.patch('/password', adminAccountLimiter, adminValidate, changeOwnPassword);
router.post('/accounts', adminAccountLimiter, adminValidate, createAdmin);
router.delete('/accounts/:id', adminAccountLimiter, adminValidate, removeAdmin);

module.exports = router;
