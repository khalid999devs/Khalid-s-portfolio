const {
  getProjects,
  createProject,
  updateProjectContents,
  editProjectInfos,
  editProjectContents,
  deleteProjectContents,
  deleteProject,
  reorderProjects,
  validateProjectIdParam,
} = require('../controllers/projects');
const adminValidate = require('../middlewares/adminTokenVerify');
const upload = require('../middlewares/uploadFile');

const router = require('express').Router();
const projectUploadFields = [
  { name: 'bannerImg', maxCount: 1 },
  { name: 'videos', maxCount: 4 },
  { name: 'thumbnailContents', maxCount: 8 },
  { name: 'sliderContents', maxCount: 8 },
];

router.post('/', getProjects);
router.post('/create', adminValidate, createProject);

router.put(
  '/update-content/:id',
  adminValidate,
  validateProjectIdParam,
  upload.fields(projectUploadFields),
  upload.validateUploadedFiles,
  updateProjectContents
);

router.patch(
  '/edit-infos/:id',
  adminValidate,
  validateProjectIdParam,
  editProjectInfos
);
router.patch('/reorder', adminValidate, reorderProjects);
router.patch(
  '/edit-contents/:id',
  adminValidate,
  validateProjectIdParam,
  upload.fields(projectUploadFields),
  upload.validateUploadedFiles,
  editProjectContents
);
router.patch(
  '/delete-contents/:id',
  adminValidate,
  validateProjectIdParam,
  deleteProjectContents
);

router.delete(
  '/delete/:id',
  adminValidate,
  validateProjectIdParam,
  deleteProject
);

module.exports = router;
