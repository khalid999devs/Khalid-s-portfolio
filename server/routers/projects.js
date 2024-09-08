const {
  getProjects,
  createProject,
  updateProjectContents,
  editProjectInfos,
  editProjectContents,
  deleteProjectContents,
  deleteProject,
} = require('../controllers/projects');
const adminValidate = require('../middlewares/adminTokenVerify');
const upload = require('../middlewares/uploadFile');

const router = require('express').Router();

router.post('/', getProjects);
router.post('/create', adminValidate, createProject);

router.put(
  '/update-content/:id',
  adminValidate,
  upload.fields([
    { name: 'bannerImg', maxCount: 1 },
    { name: 'videos' },
    { name: 'thumbnailContents' },
    { name: 'sliderContents' },
  ]),
  updateProjectContents
);

router.patch('/edit-infos/:id', adminValidate, editProjectInfos);
router.patch(
  '/edit-contents/:id',
  adminValidate,
  upload.fields([
    { name: 'bannerImg', maxCount: 1 },
    { name: 'videos' },
    { name: 'thumbnailContents' },
    { name: 'sliderContents' },
  ]),
  editProjectContents
);
router.patch('/delete-contents/:id', adminValidate, deleteProjectContents);

router.delete('/delete/:id', adminValidate, deleteProject);

module.exports = router;
