const {
  addSettings,
  editSettings,
  getSettings,
  downloadResume,
} = require('../controllers/settings');
const adminValidate = require('../middlewares/adminTokenVerify');

const router = require('express').Router();

router.get('/', getSettings);

router.post('/add', adminValidate, addSettings);
router.patch('/edit/:id', adminValidate, editSettings);

router.get('/download-resume', downloadResume);

module.exports = router;
