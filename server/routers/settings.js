const { addSettings, editSettings } = require('../controllers/settings');
const adminValidate = require('../middlewares/adminTokenVerify');

const router = require('express').Router();

router.post('/add', adminValidate, addSettings);
router.patch('/edit', adminValidate, editSettings);

module.exports = router;
