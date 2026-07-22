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
  upload.fields(projectUploadFields),
  upload.validateUploadedFiles,
  updateProjectContents
);

router.patch('/edit-infos/:id', adminValidate, editProjectInfos);
router.patch('/reorder', adminValidate, reorderProjects);
router.patch(
  '/edit-contents/:id',
  adminValidate,
  upload.fields(projectUploadFields),
  upload.validateUploadedFiles,
  editProjectContents
);
router.patch('/delete-contents/:id', adminValidate, deleteProjectContents);

router.delete('/delete/:id', adminValidate, deleteProject);

module.exports = router;
