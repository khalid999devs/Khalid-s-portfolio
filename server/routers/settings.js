const {
  addSettings,
  editSettings,
  getSettings,
} = require('../controllers/settings');
const adminValidate = require('../middlewares/adminTokenVerify');

const router = require('express').Router();

router.get('/', adminValidate, getSettings);

router.post('/add', adminValidate, addSettings);
router.patch('/edit/:id', adminValidate, editSettings);

module.exports = router;
