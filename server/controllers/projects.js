const { projects } = require('../models');
const { BadRequestError, UnauthorizedError } = require('../errors');
const deleteFile = require('../utils/deleteFile');

const createProject = async (req, res) => {
  const { title, subtitle, overview, role, date, category, locationYear } =
    req.body;
  if (!title || !subtitle || !overview || !role || !locationYear || !date)
    throw new BadRequestError(
      'Data for all the necessary fields must be provided'
    );

  let initialInfos = await projects.create({
    title,
    value: title
      .split(' ')
      .map((word) => word.toLowerCase())
      .join('-'),
    category: category || 'all',
    subtitle,
    overview,
    role: JSON.stringify(role),
    date,
    locationYear,
  });

  initialInfos.dataValues.role = JSON.parse(initialInfos.dataValues.role);
  initialInfos.dataValues.techStack = JSON.parse(
    initialInfos.dataValues.techStack
  );
  initialInfos.dataValues.sliderContents = JSON.parse(
    initialInfos.dataValues.sliderContents
  );
  initialInfos.dataValues.thumbnailContents = JSON.parse(
    initialInfos.dataValues.thumbnailContents
  );
  initialInfos.dataValues.videos = JSON.parse(initialInfos.dataValues.videos);

  res.json({
    succeed: true,
    msg: 'Successfully created the project',
    initialInfos,
  });
};

const updateProjectContents = async (req, res) => {
  const projectId = req.params.id;
  let data = req.body;

  let project = await projects.findOne({ where: { id: projectId } });
  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  if (req.files) {
    const uploadedFiles = req.files;

    if (uploadedFiles.bannerImg?.length > 0) {
      data.bannerImg = uploadedFiles.bannerImg[0].path;
    }
    if (uploadedFiles.videos?.length > 0) {
      const readyVideos = uploadedFiles.videos.map((item, index) => ({
        id: `${index + 1}@${Date.now()}`,
        url: item.path,
        serverVid: item,
      }));
      data.videos = JSON.stringify(readyVideos);
    }
    if (uploadedFiles.sliderContents?.length > 0) {
      const readySliderContents = uploadedFiles.sliderContents.map(
        (item, index) => ({
          id: `${index + 1}@${Date.now()}`,
          url: item.path,
          serverContent: item,
        })
      );
      data.sliderContents = JSON.stringify(readySliderContents);
    }
    if (uploadedFiles.thumbnailContents?.length > 0) {
      const readyThumbnailContents = uploadedFiles.thumbnailContents.map(
        (item, index) => ({
          id: `${index + 1}@${Date.now()}`,
          url: item.path,
          serverThumb: item,
        })
      );
      data.thumbnailContents = JSON.stringify(readyThumbnailContents);
    }
  }

  if (data.techStack) data.techStack = JSON.stringify(data.techStack);

  await projects.update({ ...data }, { where: { id: projectId } });

  if (data.techStack) data.techStack = JSON.parse(data.techStack);
  if (data.videos) data.videos = JSON.parse(data.videos);
  if (data.sliderContents)
    data.sliderContents = JSON.parse(data.sliderContents);

  const result = { ...project, ...data };

  res.json({
    succeed: true,
    msg: 'Successfully updated project content!',
    result: result,
  });
};

const editProjectInfos = async (req, res) => {
  const projectId = req.params.id;
  let data = req.body;

  let project = await projects.findOne({ where: { id: projectId } });
  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  if (data.bannerImg || data.videos || data.sliderContents)
    throw new UnauthorizedError(
      'You are not permitted to change this data in this route!'
    );

  if (data.techStack) data.techStack = JSON.stringify(data.techStack);
  if (data.role) data.role = JSON.stringify(data.role);

  await projects.update({ ...data }, { where: { id: projectId } });

  if (data.techStack) data.techStack = JSON.parse(data.techStack);
  if (data.role) data.role = JSON.parse(data.role);

  res.json({
    succeed: true,
    msg: 'Successfully Updated Project Infos',
    result: { ...project, ...data },
  });
};

const editProjectContents = async (req, res) => {
  const projectId = req.params.id;
  let { mode, contentId, replaceItem } = req.body;
  replaceItem = JSON.parse(replaceItem);

  let project = await projects.findOne({ where: { id: projectId } });
  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  if (req.files) {
    const uploadedFiles = req.files;

    if (mode === 'bannerImg' && uploadedFiles.bannerImg?.length > 0) {
      if (project.img) deleteFile(project.img);
      project.bannerImg = uploadedFiles.bannerImg[0].path;
    } else if (mode === 'videos' && uploadedFiles.videos?.length > 0) {
      let dataVideos = JSON.parse(project.videos);

      if (!replaceItem) {
        uploadedFiles.videos.forEach((item, index) => {
          dataVideos.push({
            id: `${dataVideos?.length + 1}@${Date.now()}`,
            url: item.path,
            serverVid: item,
          });
        });
      } else {
        dataVideos.forEach((item, index) => {
          if (contentId === item.id) {
            if (item.url) deleteFile(item.url);

            item.url = uploadedFiles.videos[0].path;
            item.serverVid = uploadedFiles.videos[0];
          }
        });
      }

      project.videos = JSON.stringify(dataVideos);
    } else if (
      mode === 'sliderContents' &&
      uploadedFiles.sliderContents?.length > 0
    ) {
      let dataSliderContents = JSON.parse(project.sliderContents);

      if (!replaceItem) {
        uploadedFiles.sliderContents.forEach((item, index) => {
          dataSliderContents.push({
            id: `${dataSliderContents?.length + 1}@${Date.now()}`,
            url: item.path,
            serverContent: item,
          });
        });
      } else {
        dataSliderContents.forEach((item, index) => {
          if (contentId === item.id) {
            if (item.url) deleteFile(item.url);
            item.url = uploadedFiles.sliderContents[0].path;
            item.serverContent = uploadedFiles.sliderContents[0];
          }
        });
      }
      project.sliderContents = JSON.stringify(dataSliderContents);
    } else if (
      mode === 'thumbnailContents' &&
      uploadedFiles.thumbnailContents?.length > 0
    ) {
      let dataThumbnailContents = JSON.parse(project.thumbnailContents);

      if (!replaceItem) {
        uploadedFiles.thumbnailContents.forEach((item, index) => {
          dataThumbnailContents.push({
            id: `${dataThumbnailContents?.length + 1}@${Date.now()}`,
            url: item.path,
            serverThumb: item,
          });
        });
      } else {
        dataThumbnailContents.forEach((item, index) => {
          if (contentId === item.id) {
            if (item.url) deleteFile(item.url);
            item.url = uploadedFiles.thumbnailContents[0].path;
            item.serverThumb = uploadedFiles.thumbnailContents[0];
          }
        });
      }
      project.thumbnailContents = JSON.stringify(dataThumbnailContents);
    }
  }

  await project.save();

  project.dataValues.videos = JSON.parse(project.dataValues.videos);
  project.dataValues.sliderContents = JSON.parse(
    project.dataValues.sliderContents
  );
  project.dataValues.thumbnailContents = JSON.parse(
    project.dataValues.thumbnailContents
  );
  // project.dataValues.techStack = JSON.parse(project.dataValues.techStack);

  res.json({
    succeed: true,
    msg: 'Successfully updated project contents!',
    result: project,
  });
};

const deleteProjectContents = async (req, res) => {
  const projectId = req.params.id;
  const { mode, contentId } = req.body;

  let project = await projects.findOne({
    attributes: [
      'id',
      'bannerImg',
      'sliderContents',
      'videos',
      'thumbnailContents',
    ],
    where: { id: projectId },
  });

  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  if (mode === 'bannerImg') {
    if (project.bannerImg) deleteFile(project.bannerImg);
    project.bannerImg = null;
  } else if (mode === 'videos') {
    let dataVideos = JSON.parse(project.videos);
    let filteredVideos = [];
    dataVideos.forEach((item) => {
      if (item.id === contentId) {
        if (item.url) deleteFile(item.url);
        item.serverVid = {};
      } else filteredVideos.push(item);
    });
    project.videos = JSON.stringify(filteredVideos);
  } else if (mode === 'sliderContents') {
    let dataSliderContents = JSON.parse(project.sliderContents);
    let filteredSliderContents = [];
    dataSliderContents.forEach((item) => {
      if (item.id === contentId) {
        if (item.url) deleteFile(item.url);
        item.serverContent = {};
      } else filteredSliderContents.push(item);
    });
    project.sliderContents = JSON.stringify(filteredSliderContents);
  } else if (mode === 'thumbnailContents') {
    let dataThumbnailContents = JSON.parse(project.thumbnailContents);
    let filteredThumbnailContents = [];
    dataThumbnailContents.forEach((item) => {
      if (item.id === contentId) {
        if (item.url) deleteFile(item.url);
        item.serverThumb = {};
      } else filteredThumbnailContents.push(item);
    });
    project.thumbnailContents = JSON.stringify(filteredThumbnailContents);
  }

  await project.save();

  res.json({
    succeed: true,
    msg: 'Successfully deleted!',
  });
};

const deleteProject = async (req, res) => {
  const projectId = req.params.id;

  let project = await projects.findOne({
    where: { id: projectId },
  });
  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  if (project.bannerImg) deleteFile(project.bannerImg);

  const projVideos = JSON.parse(project.videos);
  projVideos.forEach((item) => {
    if (item.url) deleteFile(item.url);
  });

  const projSliderContents = JSON.parse(project.sliderContents);
  projSliderContents.forEach((item) => {
    if (item.url) deleteFile(item.url);
  });

  const projThumbContents = JSON.parse(project.thumbnailContents);
  projThumbContents.forEach((item) => {
    if (item.url) deleteFile(item.url);
  });

  await project.destroy();

  res.json({
    succeed: true,
    msg: 'Successfully deleted the project!',
  });
};

const getProjects = async (req, res) => {
  const { mode, projectId } = req.body;
  let result;

  if (mode === 'all') {
    result = await projects.findAll({
      attributes: [
        'id',
        'title',
        'value',
        'bannerImg',
        'category',
        'subtitle',
        'role',
        'siteLink',
        'codeLink',
        'date',
        'thumbnailContents',
        'createdAt',
      ],
      order: [['id', 'ASC']],
    });
    result.forEach((item) => {
      item.dataValues.thumbnailContents = JSON.parse(
        item.dataValues.thumbnailContents
      );
      item.dataValues.role = JSON.parse(item.dataValues.role);
    });
  } else if (mode === 'single') {
    if (!projectId) throw new BadRequestError('Project Id must be provided!');
    result = await projects.findOne({ where: { id: projectId } });

    result.dataValues.techStack = JSON.parse(result.dataValues.techStack);
    result.dataValues.role = JSON.parse(result.dataValues.role);
    result.dataValues.videos = JSON.parse(result.dataValues.videos);
    result.dataValues.thumbnailContents = JSON.parse(
      result.dataValues.thumbnailContents
    );
    result.dataValues.sliderContents = JSON.parse(
      result.dataValues.sliderContents
    );
  } else if (mode === 'cat') {
    result = await projects.findAll({
      attributes: ['id', 'title', 'category'],
    });
    result = [...new Set(result.map((item) => item.dataValues.category))];
  }

  res.json({
    succeed: true,
    msg: 'Successfully fetched project data!',
    result: result,
  });
};

module.exports = {
  createProject,
  updateProjectContents,
  editProjectInfos,
  editProjectContents,
  deleteProjectContents,
  deleteProject,
  getProjects,
};
