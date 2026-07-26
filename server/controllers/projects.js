const { projects } = require('../models');
const { BadRequestError } = require('../errors');
const deleteFile = require('../utils/deleteFile');
const {
  EDITABLE_INFO_FIELDS,
  EDITABLE_CONTENT_FIELDS,
  JSON_ARRAY_FIELDS,
  pickProjectFields,
} = require('../utils/projectFields');
const { UPLOAD_FIELDS } = require('../utils/mediaTypes');

/**
 * Restores the array fields to arrays for the response body.
 *
 * The columns are TEXT holding JSON, so the allowlist encodes them for storage;
 * the admin panel expects arrays back. Kept as a helper so the response shape
 * stays byte-identical to what these routes returned before.
 */
/**
 * The media routes select a column with a `mode` field. Neither route checked
 * it, so an absent or misspelled value skipped every branch and still reported
 * success.
 */
const assertMediaMode = (mode) => {
  if (!UPLOAD_FIELDS.includes(mode)) {
    throw new BadRequestError(
      `"mode" must be one of: ${UPLOAD_FIELDS.join(', ')}.`
    );
  }
};

/**
 * Multipart form fields are always strings, so a boolean arrives as "true" or
 * "false" -- and is often absent entirely.
 */
const parseBooleanish = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return false;
  return value === 'true' || value === '1';
};

const decodeArrayFields = (data) => {
  const decoded = { ...data };
  for (const field of JSON_ARRAY_FIELDS) {
    if (typeof decoded[field] === 'string') {
      decoded[field] = JSON.parse(decoded[field]);
    }
  }
  return decoded;
};

const createProject = async (req, res) => {
  const { title, subtitle, overview, role, date, category, locationYear } =
    req.body;
  if (!title || !subtitle || !overview || !role || !locationYear || !date)
    throw new BadRequestError(
      'Data for all the necessary fields must be provided'
    );

  // Get the highest displayOrder to set the new project at the end
  const maxOrderProject = await projects.findOne({
    order: [['displayOrder', 'DESC']],
    attributes: ['displayOrder'],
  });
  const nextDisplayOrder = maxOrderProject
    ? maxOrderProject.displayOrder + 1
    : 0;

  let initialInfos = await projects.create({
    title,
    value: title
      .split(' ')
      .map((word) => word.toLowerCase())
      .join('-'),
    category: category || 'all',
    subtitle,
    overview,
    // Was `JSON.stringify(role)` on whatever arrived. That is how rows with
    // `role: [""]` were written -- values this route's own reader treats as
    // invalid. Validated to a non-empty array of non-empty strings.
    ...pickProjectFields({ role }, ['role']),
    date,
    locationYear,
    displayOrder: nextDisplayOrder,
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

  let project = await projects.findOne({ where: { id: projectId } });
  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  // Was `let data = req.body`, spread wholesale into `projects.update`. A caller
  // could set any column, including the media paths the delete routes later feed
  // to the filesystem. Media values below come only from what multer actually
  // wrote to disk.
  const data = pickProjectFields(req.body, EDITABLE_CONTENT_FIELDS);

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

  // `techStack` is already JSON-encoded by the allowlist.
  await projects.update({ ...data }, { where: { id: projectId } });

  const responseData = decodeArrayFields(data);
  if (responseData.videos) responseData.videos = JSON.parse(responseData.videos);
  if (responseData.sliderContents)
    responseData.sliderContents = JSON.parse(responseData.sliderContents);

  res.json({
    succeed: true,
    msg: 'Successfully updated project content!',
    result: { ...project, ...responseData },
  });
};

const editProjectInfos = async (req, res) => {
  const projectId = req.params.id;

  let project = await projects.findOne({ where: { id: projectId } });
  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  // The old guard here only rejected bannerImg, videos and sliderContents --
  // it missed thumbnailContents entirely, and let every other column through,
  // including id, value, displayOrder and createdAt. An allowlist cannot have
  // that kind of gap.
  const data = pickProjectFields(req.body, EDITABLE_INFO_FIELDS);

  await projects.update({ ...data }, { where: { id: projectId } });

  res.json({
    succeed: true,
    msg: 'Successfully Updated Project Infos',
    result: { ...project, ...decodeArrayFields(data) },
  });
};

const editProjectContents = async (req, res) => {
  const projectId = req.params.id;
  const { mode, contentId } = req.body;

  // `mode` selects which media column to write. It was never validated, so a
  // request that omitted it -- or misspelled it -- fell through every branch,
  // saved nothing, and still answered 200 "Successfully updated project
  // contents!". Any files multer had already written were left on disk with
  // nothing in the database referencing them.
  assertMediaMode(mode);
  if (!req.files?.[mode]?.length) {
    throw new BadRequestError(`No file was uploaded for "${mode}".`);
  }

  // `JSON.parse(replaceItem)` threw a SyntaxError -- surfacing as a 500 --
  // whenever the field was absent or sent as a bare form value like `false`
  // rather than JSON.
  const replaceItem = parseBooleanish(req.body.replaceItem);

  let project = await projects.findOne({ where: { id: projectId } });
  if (!project)
    throw new BadRequestError('Please Enter the correct project Id!');

  if (req.files) {
    const uploadedFiles = req.files;

    if (mode === 'bannerImg' && uploadedFiles.bannerImg?.length > 0) {
      // Was `project.img`, a column that does not exist, so this was always
      // undefined and the replaced banner was never removed from disk. Every
      // banner replacement since has left an orphan file.
      if (project.bannerImg) deleteFile(project.bannerImg);
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

  // Same defect as the edit route: an unrecognised mode matched no branch and
  // still answered "Successfully deleted!" having deleted nothing.
  assertMediaMode(mode);

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
        'displayOrder',
        'createdAt',
      ],
      order: [['displayOrder', 'ASC']],
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

const reorderProjects = async (req, res) => {
  const { projectOrders } = req.body;

  if (!projectOrders || !Array.isArray(projectOrders)) {
    throw new BadRequestError('Project orders must be provided as an array');
  }

  // `item.id` and `item.displayOrder` went straight into the query untyped, so
  // a non-numeric id reached the database as-is and a non-integer order could
  // be written to an INTEGER NOT NULL column.
  const updates = projectOrders.map((item) => {
    const id = Number(item?.id);
    const displayOrder = Number(item?.displayOrder);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new BadRequestError('Each entry needs a positive integer "id".');
    }
    if (!Number.isSafeInteger(displayOrder) || displayOrder < 0) {
      throw new BadRequestError(
        'Each entry needs a non-negative integer "displayOrder".'
      );
    }
    return { id, displayOrder };
  });

  // Previously issued in parallel with no transaction, so a failure partway
  // through left the catalogue in a half-reordered state that nothing repaired.
  await projects.sequelize.transaction(async (transaction) => {
    for (const { id, displayOrder } of updates) {
      await projects.update({ displayOrder }, { where: { id }, transaction });
    }
  });

  res.json({
    succeed: true,
    msg: 'Successfully reordered projects!',
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
  reorderProjects,
};
