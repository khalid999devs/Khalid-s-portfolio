const router = require('express').Router();
const {
  getAllAdmins,
  adminLogin,
  isAdminValidated,
  adminLogout,
} = require('../controllers/admin');
const adminValidate = require('../middlewares/adminTokenVerify');

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', adminValidate, getAllAdmins);
router.post('/login', adminLogin);
router.post('/logout', adminValidate, adminLogout);
router.get('/auth', adminValidate, isAdminValidated);

module.exports = router;
