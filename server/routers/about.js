const router = require('express').Router();
const {
  getAboutEntries,
  createAboutEntry,
  editAboutEntry,
  deleteAboutEntry,
  reorderAboutEntries,
} = require('../controllers/about');
const adminValidate = require('../middlewares/adminTokenVerify');

// Public read, because the About page renders this on every visit.
router.get('/', getAboutEntries);

// Everything that writes is admin only.
router.post('/', adminValidate, createAboutEntry);
router.patch('/reorder', adminValidate, reorderAboutEntries);
router.patch('/:id', adminValidate, editAboutEntry);
router.delete('/:id', adminValidate, deleteAboutEntry);

module.exports = router;
