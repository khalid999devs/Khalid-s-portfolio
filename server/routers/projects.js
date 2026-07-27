const {
  getProjects,
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

router.post('/', getProjects);
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
