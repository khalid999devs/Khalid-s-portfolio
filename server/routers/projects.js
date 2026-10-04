const {
  getProjects,
  getAllProjects,
  getProjectById,
  createProject,
  updateProjectContents,
  editProjectInfos,
  editProjectContents,
  deleteProjectContents,
  deleteProject,
  reorderProjects,
} = require('../controllers/projects');
const adminValidate = require('../middlewares/adminTokenVerify');
const upload = require('../middlewares/uploadFile');
const validateUploads = require('../middlewares/validateUploads');

const router = require('express').Router();

// Per-field caps. `videos`, `thumbnailContents` and `sliderContents` previously
// had no maxCount at all, so one request could store an unbounded number of
// files subject only to the global limit.
const mediaFields = upload.fields([
  { name: 'bannerImg', maxCount: 1 },
  { name: 'videos', maxCount: 6 },
  { name: 'thumbnailContents', maxCount: 6 },
  { name: 'sliderContents', maxCount: 10 },
]);

// Digits only, so the id route can never swallow a named one added later.
const numericId = (req, res, next) =>
  /^\d+$/.test(req.params.id) ? next() : next('route');

router.post('/', getProjects);
// The same reads as POST with mode 'all' and 'single', minus the CORS preflight.
router.get('/', getAllProjects);
router.get('/:id', numericId, getProjectById);
router.post('/create', adminValidate, createProject);

router.put(
  '/update-content/:id',
  adminValidate,
  mediaFields,
  validateUploads,
  updateProjectContents
);

router.patch('/edit-infos/:id', adminValidate, editProjectInfos);
router.patch('/reorder', adminValidate, reorderProjects);
router.patch(
  '/edit-contents/:id',
  adminValidate,
  mediaFields,
  validateUploads,
  editProjectContents
);
router.patch('/delete-contents/:id', adminValidate, deleteProjectContents);

router.delete('/delete/:id', adminValidate, deleteProject);

module.exports = router;
