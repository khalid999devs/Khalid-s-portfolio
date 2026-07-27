const {
  addSettings,
  editSettings,
  getSettings,
  downloadResume,
  uploadResumeFile,
  deleteResume,
} = require('../controllers/settings');
const adminValidate = require('../middlewares/adminTokenVerify');
const uploadResume = require('../middlewares/uploadResume');
const validateUploads = require('../middlewares/validateUploads');
const { RESUME_FIELD } = require('../utils/mediaTypes');

const router = require('express').Router();

router.get('/', getSettings);

router.post('/add', adminValidate, addSettings);
router.patch('/edit/:id', adminValidate, editSettings);

router.get('/download-resume', downloadResume);

/**
 * Resume management. Admin only, and the bytes are verified before the database
 * hears about them:
 *
 *   adminValidate    rejects before a single byte is accepted
 *   uploadResume     writes to uploads/assets under a random `.upload` name
 *   validateUploads  reads the header, requires a real PDF, renames to `.pdf`
 *
 * A failure after multer has written the file is cleaned up by the global error
 * handler, which calls cleanupUploads for every request.
 */
router.patch(
  '/resume',
  adminValidate,
  uploadResume.single(RESUME_FIELD),
  validateUploads,
  uploadResumeFile
);

router.delete('/resume', adminValidate, deleteResume);

module.exports = router;
