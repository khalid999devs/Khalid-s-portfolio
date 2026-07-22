const { randomBytes } = require('crypto');
const { projects, sequelize } = require('../models');
const { BadRequestError, UnauthorizedError } = require('../errors');
const deleteFile = require('../utils/deleteFile');
const { toStoredUploadPath } = require('../utils/uploadPaths');

const ARRAY_FIELDS = [
  'role',
  'techStack',
  'videos',
  'thumbnailContents',
  'sliderContents',
];
const LINK_FIELDS = ['siteLink', 'designLink', 'codeLink', 'techStack'];
const INFO_FIELDS = [
  'title',
  'subtitle',
  'overview',
  'role',
  'category',
  'date',
  'locationYear',
  ...LINK_FIELDS,
];
const CONTENT_MODES = [
  'bannerImg',
  'videos',
  'thumbnailContents',
  'sliderContents',
];
const CONTENT_METADATA_KEYS = {
  videos: 'serverVid',
  thumbnailContents: 'serverThumb',
  sliderContents: 'serverContent',
};

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const assertOnlyFields = (data, allowedFields) => {
  const unexpectedField = Object.keys(data || {}).find(
    (field) => !allowedFields.includes(field)
  );

  if (unexpectedField) {
    throw new BadRequestError(`Unexpected field: ${unexpectedField}`);
  }
};

const pickFields = (data, allowedFields) => {
  const picked = {};

  allowedFields.forEach((field) => {
    if (hasOwn(data, field) && data[field] !== undefined) {
      picked[field] = data[field];
    }
  });

  return picked;
};

const parseArray = (value, fieldName) => {
  let parsedValue = value;

  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch (error) {
      throw new BadRequestError(`${fieldName} must be a valid array`);
    }
  }

  if (!Array.isArray(parsedValue)) {
    throw new BadRequestError(`${fieldName} must be an array`);
  }

  return parsedValue;
};

const parseStoredArray = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  return parseArray(value, fieldName);
};

const normalizeArrayFieldsForStorage = (data, fields) => {
  fields.forEach((field) => {
    if (hasOwn(data, field)) {
      data[field] = JSON.stringify(parseArray(data[field], field));
    }
  });
};

const assertScalarFields = (data, fields) => {
  fields.forEach((field) => {
    if (
      hasOwn(data, field) &&
      data[field] !== undefined &&
      data[field] !== null &&
      typeof data[field] !== 'string'
    ) {
      throw new BadRequestError(`${field} must be a string`);
    }
  });
};

const parseBoolean = (value, fieldName) => {
  if (value === undefined || value === false || value === 'false') {
    return false;
  }
  if (value === true || value === 'true') {
    return true;
  }

  throw new BadRequestError(`${fieldName} must be true or false`);
};

const getUploadedFiles = (req) =>
  Object.values(req.files || {})
    .flat()
    .filter(Boolean);

const cleanupUploadedFiles = (req) => {
  getUploadedFiles(req).forEach((file) => {
    try {
      deleteFile(toStoredUploadPath(file.path));
    } catch (error) {
      // Do not attempt a broader fallback deletion: if containment validation
      // fails, preserving a file is safer than unlinking an unknown path.
      console.error('Unable to clean up a rejected upload safely', error);
    }
  });
};

const deleteStoredFilesSafely = (storedPaths) => {
  [...new Set(storedPaths.filter(Boolean))].forEach((storedPath) => {
    try {
      deleteFile(storedPath);
    } catch (error) {
      // The database operation has already succeeded. Keep serving a correct
      // response and surface the orphan/suspicious path in server diagnostics.
      console.error('Unable to delete a stored upload safely', error);
    }
  });
};

const publicFileMetadata = (file, storedPath) => ({
  fieldname: file.fieldname,
  filename: file.filename,
  mimetype: file.mimetype,
  path: storedPath,
  size: file.size,
});

const createContentItem = (file, metadataKey, id) => {
  const storedPath = toStoredUploadPath(file.path);

  return {
    id:
      id ||
      `${Date.now()}-${randomBytes(8).toString('hex')}`,
    url: storedPath,
    [metadataKey]: publicFileMetadata(file, storedPath),
  };
};

const projectForResponse = (project) => {
  const data = project.get
    ? project.get({ plain: true })
    : { ...project };

  ARRAY_FIELDS.forEach((field) => {
    if (hasOwn(data, field)) {
      data[field] = parseStoredArray(data[field], field);
    }
  });

  return data;
};

const collectContentPaths = (project, field) =>
  parseStoredArray(project[field], field)
    .map((item) => item?.url)
    .filter(Boolean);

const createProject = async (req, res) => {
  const body = req.body || {};
  assertOnlyFields(body, [
    'title',
    'subtitle',
    'overview',
    'role',
    'date',
    'category',
    'locationYear',
  ]);

  const { title, subtitle, overview, role, date, category, locationYear } =
    body;
  if (!title || !subtitle || !overview || !role || !locationYear || !date) {
    throw new BadRequestError(
      'Data for all the necessary fields must be provided'
    );
  }

  assertScalarFields(
    { title, subtitle, overview, date, category, locationYear },
    ['title', 'subtitle', 'overview', 'date', 'category', 'locationYear']
  );
  const normalizedRole = parseArray(role, 'role');

  const maxOrderProject = await projects.findOne({
    order: [['displayOrder', 'DESC']],
    attributes: ['displayOrder'],
  });
  const nextDisplayOrder = maxOrderProject
    ? maxOrderProject.displayOrder + 1
    : 0;

  const initialInfos = await projects.create({
    title,
    value: title
      .split(' ')
      .map((word) => word.toLowerCase())
      .join('-'),
    category: category || 'all',
    subtitle,
    overview,
    role: JSON.stringify(normalizedRole),
    date,
    locationYear,
    displayOrder: nextDisplayOrder,
  });

  res.json({
    succeed: true,
    msg: 'Successfully created the project',
    initialInfos: projectForResponse(initialInfos),
  });
};

const updateProjectContents = async (req, res) => {
  let committed = false;

  try {
    const body = req.body || {};
    // Older clients included title because it once selected the upload folder.
    // Accept but ignore it; the immutable route id now chooses the folder.
    assertOnlyFields(body, [...LINK_FIELDS, 'title']);
    const data = pickFields(body, LINK_FIELDS);
    assertScalarFields(data, ['siteLink', 'designLink', 'codeLink']);
    normalizeArrayFieldsForStorage(data, ['techStack']);

    const project = await projects.findByPk(req.params.id);
    if (!project) {
      throw new BadRequestError('Please enter the correct project id');
    }

    const stalePaths = [];
    const uploadedFiles = req.files || {};

    if (uploadedFiles.bannerImg?.length) {
      if (project.bannerImg) stalePaths.push(project.bannerImg);
      data.bannerImg = toStoredUploadPath(uploadedFiles.bannerImg[0].path);
    }

    ['videos', 'sliderContents', 'thumbnailContents'].forEach((field) => {
      if (uploadedFiles[field]?.length) {
        stalePaths.push(...collectContentPaths(project, field));
        data[field] = JSON.stringify(
          uploadedFiles[field].map((file) =>
            createContentItem(file, CONTENT_METADATA_KEYS[field])
          )
        );
      }
    });

    if (Object.keys(data).length === 0) {
      throw new BadRequestError('No supported project content was provided');
    }

    await project.update(data);
    committed = true;
    deleteStoredFilesSafely(stalePaths);

    res.json({
      succeed: true,
      msg: 'Successfully updated project content!',
      result: projectForResponse(project),
    });
  } catch (error) {
    if (!committed) cleanupUploadedFiles(req);
    throw error;
  }
};

const editProjectInfos = async (req, res) => {
  const body = req.body || {};
  const mediaField = Object.keys(body).find((field) =>
    CONTENT_MODES.includes(field)
  );
  if (mediaField) {
    throw new UnauthorizedError(
      'Project media cannot be changed through this route'
    );
  }

  assertOnlyFields(body, INFO_FIELDS);
  const data = pickFields(body, INFO_FIELDS);
  assertScalarFields(data, [
    'title',
    'subtitle',
    'overview',
    'category',
    'date',
    'locationYear',
    'siteLink',
    'designLink',
    'codeLink',
  ]);
  normalizeArrayFieldsForStorage(data, ['techStack', 'role']);

  if (Object.keys(data).length === 0) {
    throw new BadRequestError('No supported project information was provided');
  }

  const project = await projects.findByPk(req.params.id);
  if (!project) {
    throw new BadRequestError('Please enter the correct project id');
  }

  await project.update(data);

  res.json({
    succeed: true,
    msg: 'Successfully updated project information',
    result: projectForResponse(project),
  });
};

const editProjectContents = async (req, res) => {
  let committed = false;

  try {
    const body = req.body || {};
    assertOnlyFields(body, [
      'mode',
      'contentId',
      'replaceItem',
      'title',
    ]);

    const { mode, contentId } = body;
    if (!CONTENT_MODES.includes(mode)) {
      throw new BadRequestError('A valid project content mode is required');
    }

    const replaceItem = parseBoolean(body.replaceItem, 'replaceItem');
    const uploadedFiles = getUploadedFiles(req);
    const modeFiles = req.files?.[mode] || [];

    if (
      modeFiles.length === 0 ||
      uploadedFiles.some((file) => file.fieldname !== mode)
    ) {
      throw new BadRequestError('Uploaded files must match the selected mode');
    }

    if ((mode === 'bannerImg' || replaceItem) && modeFiles.length !== 1) {
      throw new BadRequestError('This operation requires exactly one file');
    }

    const project = await projects.findByPk(req.params.id);
    if (!project) {
      throw new BadRequestError('Please enter the correct project id');
    }

    const stalePaths = [];
    if (mode === 'bannerImg') {
      if (project.bannerImg) stalePaths.push(project.bannerImg);
      project.bannerImg = toStoredUploadPath(modeFiles[0].path);
    } else {
      const contentItems = parseStoredArray(project[mode], mode);
      const metadataKey = CONTENT_METADATA_KEYS[mode];

      if (replaceItem) {
        if (!contentId || contentId === 'null') {
          throw new BadRequestError('A content id is required for replacement');
        }

        const itemIndex = contentItems.findIndex(
          (item) =>
            item &&
            typeof item === 'object' &&
            String(item.id) === String(contentId)
        );
        if (itemIndex === -1) {
          throw new BadRequestError('The requested project content was not found');
        }

        if (contentItems[itemIndex].url) {
          stalePaths.push(contentItems[itemIndex].url);
        }
        contentItems[itemIndex] = createContentItem(
          modeFiles[0],
          metadataKey,
          contentItems[itemIndex].id
        );
      } else {
        contentItems.push(
          ...modeFiles.map((file) => createContentItem(file, metadataKey))
        );
      }

      project[mode] = JSON.stringify(contentItems);
    }

    await project.save({ fields: [mode] });
    committed = true;
    deleteStoredFilesSafely(stalePaths);

    res.json({
      succeed: true,
      msg: 'Successfully updated project contents!',
      result: projectForResponse(project),
    });
  } catch (error) {
    if (!committed) cleanupUploadedFiles(req);
    throw error;
  }
};

const deleteProjectContents = async (req, res) => {
  const body = req.body || {};
  assertOnlyFields(body, ['mode', 'contentId']);
  const { mode, contentId } = body;
  if (!CONTENT_MODES.includes(mode)) {
    throw new BadRequestError('A valid project content mode is required');
  }

  const project = await projects.findByPk(req.params.id);
  if (!project) {
    throw new BadRequestError('Please enter the correct project id');
  }

  const stalePaths = [];
  if (mode === 'bannerImg') {
    if (project.bannerImg) stalePaths.push(project.bannerImg);
    project.bannerImg = null;
  } else {
    if (!contentId) {
      throw new BadRequestError('A content id is required');
    }

    const contentItems = parseStoredArray(project[mode], mode);
    const itemIndex = contentItems.findIndex(
      (item) =>
        item &&
        typeof item === 'object' &&
        String(item.id) === String(contentId)
    );
    if (itemIndex === -1) {
      throw new BadRequestError('The requested project content was not found');
    }

    if (contentItems[itemIndex].url) {
      stalePaths.push(contentItems[itemIndex].url);
    }
    contentItems.splice(itemIndex, 1);
    project[mode] = JSON.stringify(contentItems);
  }

  await project.save({ fields: [mode] });
  deleteStoredFilesSafely(stalePaths);

  res.json({
    succeed: true,
    msg: 'Successfully deleted!',
  });
};

const deleteProject = async (req, res) => {
  const project = await projects.findByPk(req.params.id);
  if (!project) {
    throw new BadRequestError('Please enter the correct project id');
  }

  const storedPaths = [
    project.bannerImg,
    ...collectContentPaths(project, 'videos'),
    ...collectContentPaths(project, 'sliderContents'),
    ...collectContentPaths(project, 'thumbnailContents'),
  ];

  // Remove the database record first. A failed filesystem cleanup leaves an
  // orphan for maintenance; deleting files first could leave broken DB rows.
  await project.destroy();
  deleteStoredFilesSafely(storedPaths);

  res.json({
    succeed: true,
    msg: 'Successfully deleted the project!',
  });
};

const getProjects = async (req, res) => {
  const body = req.body || {};
  assertOnlyFields(body, ['mode', 'projectId']);
  const { mode, projectId } = body;
  let result;

  if (mode === 'all') {
    const projectRows = await projects.findAll({
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
    result = projectRows.map(projectForResponse);
  } else if (mode === 'single') {
    if (!projectId) {
      throw new BadRequestError('Project id must be provided');
    }

    const project = await projects.findByPk(projectId);
    if (!project) {
      throw new BadRequestError('The requested project was not found');
    }
    result = projectForResponse(project);
  } else if (mode === 'cat') {
    const projectRows = await projects.findAll({
      attributes: ['id', 'title', 'category'],
    });
    result = [
      ...new Set(projectRows.map((item) => item.dataValues.category)),
    ];
  } else {
    throw new BadRequestError('A valid project query mode is required');
  }

  res.json({
    succeed: true,
    msg: 'Successfully fetched project data!',
    result,
  });
};

const reorderProjects = async (req, res) => {
  const body = req.body || {};
  assertOnlyFields(body, ['projectOrders']);
  const { projectOrders } = body;

  if (!Array.isArray(projectOrders) || projectOrders.length > 500) {
    throw new BadRequestError(
      'Project orders must be provided as an array of at most 500 items'
    );
  }

  const seenIds = new Set();
  const seenDisplayOrders = new Set();
  projectOrders.forEach((item) => {
    if (
      !item ||
      !Number.isInteger(item.id) ||
      !Number.isInteger(item.displayOrder) ||
      item.displayOrder < 0 ||
      item.displayOrder >= projectOrders.length ||
      seenIds.has(item.id) ||
      seenDisplayOrders.has(item.displayOrder)
    ) {
      throw new BadRequestError('Project orders contain invalid values');
    }
    seenIds.add(item.id);
    seenDisplayOrders.add(item.displayOrder);
  });

  await sequelize.transaction((transaction) =>
    Promise.all(
      projectOrders.map((item) =>
        projects.update(
          { displayOrder: item.displayOrder },
          { transaction, where: { id: item.id } }
        )
      )
    )
  );

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
