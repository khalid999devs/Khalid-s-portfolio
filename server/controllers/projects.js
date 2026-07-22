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
const URL_FIELDS = ['siteLink', 'designLink', 'codeLink'];
const LINK_FIELDS = [...URL_FIELDS, 'techStack'];
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
const CONTENT_ITEM_LIMITS = {
  videos: 32,
  thumbnailContents: 64,
  sliderContents: 64,
};

const MAX_DATABASE_ID = 2_147_483_647;
const MAX_PROJECT_CREATE_ATTEMPTS = 3;
const MAX_REORDER_ITEMS = 500;
const MAX_SLUG_LENGTH = 160;
const FIELD_RULES = {
  title: { maxLength: 160, required: true, singleLine: true },
  subtitle: { maxLength: 255, required: true, singleLine: true },
  overview: { maxBytes: 60_000, maxLength: 20_000, required: true },
  category: { maxLength: 80, required: true, singleLine: true },
  date: { maxLength: 80, required: true, singleLine: true },
  locationYear: { maxLength: 160, required: true, singleLine: true },
};
const ARRAY_RULES = {
  role: { maxItems: 32, maxItemLength: 120, required: true },
  techStack: { maxItems: 64, maxItemLength: 120 },
};
const LINK_RULES = {
  maxLength: 255,
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

const normalizeText = (value, fieldName, rules = {}) => {
  const {
    maxBytes,
    maxLength,
    required = false,
    singleLine = false,
    allowNull = false,
  } = rules;

  if (value === null && allowNull) return null;
  if (typeof value !== 'string') {
    throw new BadRequestError(`${fieldName} must be a string`);
  }

  let normalized = value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (/\p{Cc}/u.test(normalized.replace(/[\t\n]/g, ''))) {
    throw new BadRequestError(`${fieldName} contains invalid control characters`);
  }
  if (singleLine && /[\n\r\u2028\u2029]/u.test(normalized)) {
    throw new BadRequestError(`${fieldName} must be a single line`);
  }
  if (singleLine) normalized = normalized.replace(/[\t ]+/gu, ' ');
  if (required && normalized.length === 0) {
    throw new BadRequestError(`${fieldName} must not be empty`);
  }
  if (maxLength && [...normalized].length > maxLength) {
    throw new BadRequestError(
      `${fieldName} must be at most ${maxLength} characters`
    );
  }
  if (maxBytes && Buffer.byteLength(normalized, 'utf8') > maxBytes) {
    throw new BadRequestError(
      `${fieldName} must be at most ${maxBytes} UTF-8 bytes`
    );
  }

  return normalized;
};

const normalizeUrl = (value, fieldName) => {
  const normalized = normalizeText(value, fieldName, {
    ...LINK_RULES,
    allowNull: true,
    singleLine: true,
  });

  if (normalized === null || normalized === '') return normalized;

  let parsedUrl;
  try {
    parsedUrl = new URL(normalized);
  } catch (error) {
    throw new BadRequestError(`${fieldName} must be a valid HTTP(S) URL`);
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new BadRequestError(`${fieldName} must be a valid HTTP(S) URL`);
  }

  const canonicalUrl = parsedUrl.toString();
  if ([...canonicalUrl].length > LINK_RULES.maxLength) {
    throw new BadRequestError(
      `${fieldName} must be at most ${LINK_RULES.maxLength} characters`
    );
  }

  return canonicalUrl;
};

const normalizeScalarFields = (data, fields) => {
  fields.forEach((field) => {
    if (!hasOwn(data, field)) return;

    data[field] = URL_FIELDS.includes(field)
      ? normalizeUrl(data[field], field)
      : normalizeText(data[field], field, FIELD_RULES[field]);
  });
};

const parsePositiveProjectId = (value, fieldName = 'Project id') => {
  const isCanonicalString =
    typeof value === 'string' && /^[1-9]\d{0,9}$/u.test(value);
  const parsedValue = isCanonicalString ? Number(value) : value;

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue > MAX_DATABASE_ID
  ) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
};

const validateProjectIdParam = (req, _res, next) => {
  try {
    req.projectId = parsePositiveProjectId(req.params?.id);
    next();
  } catch (error) {
    next(error);
  }
};

const normalizeContentId = (value, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new BadRequestError('A content id is required');
    }
    return undefined;
  }

  if (
    typeof value !== 'string' &&
    !(Number.isSafeInteger(value) && value > 0)
  ) {
    throw new BadRequestError('Content id must be a string');
  }

  const normalized = normalizeText(String(value), 'Content id', {
    maxLength: 128,
    required: true,
    singleLine: true,
  });

  if (normalized.toLowerCase() === 'null') {
    throw new BadRequestError('A valid content id is required');
  }

  return normalized;
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
    if (!hasOwn(data, field)) return;

    const rules = ARRAY_RULES[field];
    const parsedValue = parseArray(data[field], field);
    if (parsedValue.length > rules.maxItems) {
      throw new BadRequestError(
        `${field} must contain at most ${rules.maxItems} items`
      );
    }

    const seenItems = new Set();
    const normalizedItems = parsedValue.reduce((items, item) => {
      const normalizedItem = normalizeText(item, `${field} item`, {
        maxLength: rules.maxItemLength,
        required: true,
        singleLine: true,
      });

      if (!seenItems.has(normalizedItem)) {
        seenItems.add(normalizedItem);
        items.push(normalizedItem);
      }
      return items;
    }, []);

    if (rules.required && normalizedItems.length === 0) {
      throw new BadRequestError(`${field} must contain at least one item`);
    }

    data[field] = JSON.stringify(normalizedItems);
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

const slugifyTitle = (title) => {
  const slug = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/gu, ' and ')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/gu, '');

  return slug || 'project';
};

const findAvailableSlug = async (title, transaction) => {
  const baseSlug = slugifyTitle(title);
  const candidateExists = async (value) =>
    Boolean(
      await projects.findOne({
        attributes: ['id'],
        lock: transaction.LOCK?.UPDATE,
        transaction,
        where: { value },
      })
    );

  if (!(await candidateExists(baseSlug))) return baseSlug;

  // A database uniqueness constraint is still the ultimate concurrency guard,
  // but a random suffix plus an existence check avoids ordinary collisions
  // without changing URLs for existing records.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomBytes(6).toString('hex');
    const candidate = `${baseSlug.slice(
      0,
      MAX_SLUG_LENGTH - suffix.length - 1
    )}-${suffix}`;
    if (!(await candidateExists(candidate))) return candidate;
  }

  throw new BadRequestError('Unable to generate a unique project URL');
};

const isSlugUniqueConstraintError = (error) => {
  if (error?.name !== 'SequelizeUniqueConstraintError') return false;

  const fieldNames = Array.isArray(error.fields)
    ? error.fields
    : Object.keys(error.fields || {});
  if (fieldNames.includes('value')) return true;
  if (error.errors?.some((item) => item?.path === 'value')) return true;

  return [
    error.constraint,
    error.original?.constraint,
    error.parent?.constraint,
    error.original?.sqlMessage,
    error.parent?.sqlMessage,
  ].some((value) => String(value || '').includes('projects_value_unique'));
};

const getUploadedFiles = (req) =>
  Object.values(req.files || {})
    .flat()
    .filter(Boolean);

const cleanupUploadedFiles = async (req) => {
  await Promise.all(
    getUploadedFiles(req).map(async (file) => {
      try {
        await deleteFile(toStoredUploadPath(file.path));
      } catch (error) {
        // Do not attempt a broader fallback deletion: if containment validation
        // fails, preserving a file is safer than unlinking an unknown path.
        console.error('Unable to clean up a rejected upload safely', error);
      }
    })
  );
};

const deleteStoredFilesSafely = async (storedPaths) => {
  await Promise.all(
    [...new Set(storedPaths.filter(Boolean))].map(async (storedPath) => {
      try {
        await deleteFile(storedPath);
      } catch (error) {
        // The database operation has already succeeded. Keep serving a correct
        // response and surface the orphan/suspicious path in server diagnostics.
        console.error('Unable to delete a stored upload safely', error);
      }
    })
  );
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
  const allowedFields = [
    'title',
    'subtitle',
    'overview',
    'role',
    'date',
    'category',
    'locationYear',
  ];
  assertOnlyFields(body, allowedFields);

  const requiredFields = [
    'title',
    'subtitle',
    'overview',
    'role',
    'date',
    'locationYear',
  ];
  if (
    requiredFields.some(
      (field) => !hasOwn(body, field) || body[field] === undefined
    )
  ) {
    throw new BadRequestError(
      'Data for all the necessary fields must be provided'
    );
  }

  const data = pickFields(body, allowedFields);
  normalizeScalarFields(data, [
    'title',
    'subtitle',
    'overview',
    'category',
    'date',
    'locationYear',
  ]);
  normalizeArrayFieldsForStorage(data, ['role']);
  if (!hasOwn(data, 'category')) data.category = 'all';

  let initialInfos;
  for (let attempt = 0; attempt < MAX_PROJECT_CREATE_ATTEMPTS; attempt += 1) {
    try {
      initialInfos = await sequelize.transaction(async (transaction) => {
        const value = await findAvailableSlug(data.title, transaction);
        const maxOrderProject = await projects.findOne({
          attributes: ['displayOrder'],
          lock: transaction.LOCK?.UPDATE,
          order: [['displayOrder', 'DESC']],
          transaction,
        });
        const currentMaxOrder = maxOrderProject?.displayOrder;
        if (
          currentMaxOrder !== undefined &&
          (!Number.isInteger(currentMaxOrder) ||
            currentMaxOrder < 0 ||
            currentMaxOrder >= MAX_DATABASE_ID)
        ) {
          throw new BadRequestError('Existing project order data is invalid');
        }

        return projects.create(
          {
            ...data,
            value,
            displayOrder: maxOrderProject ? currentMaxOrder + 1 : 0,
          },
          { transaction }
        );
      });
      break;
    } catch (error) {
      if (!isSlugUniqueConstraintError(error)) throw error;
      if (attempt === MAX_PROJECT_CREATE_ATTEMPTS - 1) {
        throw new BadRequestError(
          'Unable to reserve a unique project URL; please retry'
        );
      }
    }
  }

  res.json({
    succeed: true,
    msg: 'Successfully created the project',
    initialInfos: projectForResponse(initialInfos),
  });
};

const updateProjectContents = async (req, res) => {
  let committed = false;

  try {
    const projectId = parsePositiveProjectId(req.params?.id);
    const body = req.body || {};
    // Older clients included title because it once selected the upload folder.
    // Accept but ignore it; the immutable route id now chooses the folder.
    assertOnlyFields(body, [...LINK_FIELDS, 'title']);
    if (hasOwn(body, 'title')) {
      normalizeText(body.title, 'title', {
        maxLength: 255,
        singleLine: true,
      });
    }
    const data = pickFields(body, LINK_FIELDS);
    normalizeScalarFields(data, URL_FIELDS);
    normalizeArrayFieldsForStorage(data, ['techStack']);

    const project = await projects.findByPk(projectId);
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
    await deleteStoredFilesSafely(stalePaths);

    res.json({
      succeed: true,
      msg: 'Successfully updated project content!',
      result: projectForResponse(project),
    });
  } catch (error) {
    if (!committed) await cleanupUploadedFiles(req);
    throw error;
  }
};

const editProjectInfos = async (req, res) => {
  const projectId = parsePositiveProjectId(req.params?.id);
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
  normalizeScalarFields(data, [
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

  const project = await projects.findByPk(projectId);
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
    const projectId = parsePositiveProjectId(req.params?.id);
    const body = req.body || {};
    assertOnlyFields(body, [
      'mode',
      'contentId',
      'replaceItem',
      'title',
    ]);

    const { mode, contentId } = body;
    if (hasOwn(body, 'title')) {
      normalizeText(body.title, 'title', {
        maxLength: 255,
        singleLine: true,
      });
    }
    if (!CONTENT_MODES.includes(mode)) {
      throw new BadRequestError('A valid project content mode is required');
    }

    const replaceItem = parseBoolean(body.replaceItem, 'replaceItem');
    const normalizedContentId = normalizeContentId(
      contentId,
      replaceItem && mode !== 'bannerImg'
    );
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

    const project = await projects.findByPk(projectId);
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
        const itemIndex = contentItems.findIndex(
          (item) =>
            item &&
            typeof item === 'object' &&
            String(item.id) === normalizedContentId
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
        if (
          contentItems.length + modeFiles.length >
          CONTENT_ITEM_LIMITS[mode]
        ) {
          throw new BadRequestError(
            `${mode} cannot contain more than ${CONTENT_ITEM_LIMITS[mode]} items`
          );
        }
        contentItems.push(
          ...modeFiles.map((file) => createContentItem(file, metadataKey))
        );
      }

      project[mode] = JSON.stringify(contentItems);
    }

    await project.save({ fields: [mode] });
    committed = true;
    await deleteStoredFilesSafely(stalePaths);

    res.json({
      succeed: true,
      msg: 'Successfully updated project contents!',
      result: projectForResponse(project),
    });
  } catch (error) {
    if (!committed) await cleanupUploadedFiles(req);
    throw error;
  }
};

const deleteProjectContents = async (req, res) => {
  const projectId = parsePositiveProjectId(req.params?.id);
  const body = req.body || {};
  assertOnlyFields(body, ['mode', 'contentId']);
  const { mode, contentId } = body;
  if (!CONTENT_MODES.includes(mode)) {
    throw new BadRequestError('A valid project content mode is required');
  }
  const normalizedContentId = normalizeContentId(
    contentId,
    mode !== 'bannerImg'
  );

  const project = await projects.findByPk(projectId);
  if (!project) {
    throw new BadRequestError('Please enter the correct project id');
  }

  const stalePaths = [];
  if (mode === 'bannerImg') {
    if (project.bannerImg) stalePaths.push(project.bannerImg);
    project.bannerImg = null;
  } else {
    const contentItems = parseStoredArray(project[mode], mode);
    const itemIndex = contentItems.findIndex(
      (item) =>
        item &&
        typeof item === 'object' &&
        String(item.id) === normalizedContentId
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
  await deleteStoredFilesSafely(stalePaths);

  res.json({
    succeed: true,
    msg: 'Successfully deleted!',
  });
};

const deleteProject = async (req, res) => {
  const projectId = parsePositiveProjectId(req.params?.id);
  const project = await projects.findByPk(projectId);
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
  await deleteStoredFilesSafely(storedPaths);

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
      order: [
        ['displayOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    result = projectRows.map(projectForResponse);
  } else if (mode === 'single') {
    if (projectId === undefined || projectId === null || projectId === '') {
      throw new BadRequestError('Project id must be provided');
    }

    const normalizedProjectId = parsePositiveProjectId(projectId);
    const project = await projects.findByPk(normalizedProjectId);
    if (!project) {
      throw new BadRequestError('The requested project was not found');
    }
    result = projectForResponse(project);
  } else if (mode === 'cat') {
    const projectRows = await projects.findAll({
      attributes: ['id', 'title', 'category'],
      order: [
        ['category', 'ASC'],
        ['id', 'ASC'],
      ],
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

  if (
    !Array.isArray(projectOrders) ||
    projectOrders.length > MAX_REORDER_ITEMS
  ) {
    throw new BadRequestError(
      `Project orders must be provided as an array of at most ${MAX_REORDER_ITEMS} items`
    );
  }

  const seenIds = new Set();
  const seenDisplayOrders = new Set();
  projectOrders.forEach((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.keys(item).some(
        (field) => !['id', 'displayOrder'].includes(field)
      ) ||
      !Number.isInteger(item.id) ||
      item.id <= 0 ||
      item.id > MAX_DATABASE_ID ||
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

  await sequelize.transaction(async (transaction) => {
    const projectRows = await projects.findAll({
      attributes: ['id'],
      lock: transaction.LOCK?.UPDATE,
      order: [['id', 'ASC']],
      transaction,
    });
    const storedIds = projectRows.map((project) =>
      project.get ? project.get('id') : project.id ?? project.dataValues?.id
    );

    if (
      storedIds.length !== projectOrders.length ||
      storedIds.some((id) => !seenIds.has(id))
    ) {
      throw new BadRequestError(
        'Project orders must contain every existing project exactly once'
      );
    }

    // Run updates serially on the same transaction/connection. This keeps the
    // final state deterministic and avoids reporting success for a partial set.
    for (const item of projectOrders) {
      await projects.update(
        { displayOrder: item.displayOrder },
        { transaction, where: { id: item.id } }
      );
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
  validateProjectIdParam,
};
