const assert = require('node:assert/strict');
const { existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const { projects, sequelize } = require('../models');
const {
  createProject,
  deleteProject,
  deleteProjectContents,
  editProjectContents,
  editProjectInfos,
  getProjects,
  reorderProjects,
  updateProjectContents,
  validateProjectIdParam,
} = require('../controllers/projects');
const projectRouter = require('../routers/projects');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');

test('update-content rejects client-controlled stored media paths', async () => {
  await assert.rejects(
    updateProjectContents(
      {
        body: { bannerImg: '/etc/passwd' },
        files: {},
        params: { id: '1' },
      },
      {}
    ),
    (error) =>
      error.statusCode === 400 && error.message === 'Unexpected field: bannerImg'
  );
});

test('edit-infos rejects media and model-control fields', async () => {
  await assert.rejects(
    editProjectInfos(
      {
        body: { videos: '[{"url":"/etc/passwd"}]' },
        params: { id: '1' },
      },
      {}
    ),
    (error) => error.statusCode === 403
  );

  await assert.rejects(
    editProjectInfos(
      {
        body: { displayOrder: 0 },
        params: { id: '1' },
      },
      {}
    ),
    (error) =>
      error.statusCode === 400 &&
      error.message === 'Unexpected field: displayOrder'
  );
});

test('edit-contents rejects extra body fields before persistence', async () => {
  await assert.rejects(
    editProjectContents(
      {
        body: {
          mode: 'videos',
          replaceItem: 'false',
          videos: '[{"url":"uploads/../../outside"}]',
        },
        files: {},
        params: { id: '1' },
      },
      {}
    ),
    (error) =>
      error.statusCode === 400 && error.message === 'Unexpected field: videos'
  );
});

test('a controller failure removes newly written uploads', async () => {
  const originalFindByPk = projects.findByPk;
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `controller-cleanup-test-${process.pid}-${Date.now()}`
  );
  const testFile = resolve(testDirectory, 'bannerImg-test.webp');

  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(testFile, 'test');
  projects.findByPk = async () => null;

  try {
    await assert.rejects(
      updateProjectContents(
        {
          body: {},
          files: {
            bannerImg: [
              {
                fieldname: 'bannerImg',
                filename: 'bannerImg-test.webp',
                mimetype: 'image/webp',
                path: testFile,
                size: 4,
              },
            ],
          },
          params: { id: '999999' },
        },
        {}
      ),
      (error) => error.statusCode === 400
    );

    assert.equal(existsSync(testFile), false);
  } finally {
    projects.findByPk = originalFindByPk;
    rmSync(testDirectory, { recursive: true, force: true });
  }
});

test('project reorder rejects duplicate or non-contiguous positions', async () => {
  await assert.rejects(
    reorderProjects(
      {
        body: {
          projectOrders: [
            { id: 1, displayOrder: 0 },
            { id: 2, displayOrder: 0 },
          ],
        },
      },
      {}
    ),
    /Project orders contain invalid values/
  );

  await assert.rejects(
    reorderProjects(
      {
        body: {
          projectOrders: [
            { id: 1, displayOrder: 0 },
            { id: 2, displayOrder: 2 },
          ],
        },
      },
      {}
    ),
    /Project orders contain invalid values/
  );
});

test('project reorder updates all positions in one transaction', async () => {
  const originalTransaction = sequelize.transaction;
  const originalFindAll = projects.findAll;
  const originalUpdate = projects.update;
  const transaction = {
    id: 'test-transaction',
    LOCK: { UPDATE: 'UPDATE' },
  };
  const updates = [];
  let findAllOptions;
  let responseBody;

  sequelize.transaction = async (callback) => callback(transaction);
  projects.findAll = async (options) => {
    findAllOptions = options;
    return [{ id: 5 }, { id: 8 }];
  };
  projects.update = async (values, options) => {
    updates.push({ values, options });
    return [1];
  };

  try {
    await reorderProjects(
      {
        body: {
          projectOrders: [
            { id: 8, displayOrder: 0 },
            { id: 5, displayOrder: 1 },
          ],
        },
      },
      {
        json(value) {
          responseBody = value;
        },
      }
    );

    assert.equal(responseBody.succeed, true);
    assert.equal(findAllOptions.transaction, transaction);
    assert.equal(findAllOptions.lock, 'UPDATE');
    assert.deepEqual(updates, [
      {
        values: { displayOrder: 0 },
        options: { transaction, where: { id: 8 } },
      },
      {
        values: { displayOrder: 1 },
        options: { transaction, where: { id: 5 } },
      },
    ]);
  } finally {
    sequelize.transaction = originalTransaction;
    projects.findAll = originalFindAll;
    projects.update = originalUpdate;
  }
});

test('all project mutation routes reject non-canonical route ids before lookup', async () => {
  const originalFindByPk = projects.findByPk;
  let lookupCount = 0;
  projects.findByPk = async () => {
    lookupCount += 1;
    return null;
  };

  const requests = [
    () =>
      updateProjectContents(
        { body: {}, files: {}, params: { id: '01' } },
        {}
      ),
    () =>
      editProjectInfos(
        { body: { title: 'Valid title' }, params: { id: '01' } },
        {}
      ),
    () =>
      editProjectContents(
        { body: {}, files: {}, params: { id: '01' } },
        {}
      ),
    () =>
      deleteProjectContents(
        { body: { mode: 'bannerImg' }, params: { id: '01' } },
        {}
      ),
    () => deleteProject({ params: { id: '01' } }, {}),
  ];

  try {
    for (const request of requests) {
      await assert.rejects(
        request(),
        (error) =>
          error.statusCode === 400 &&
          error.message === 'Project id must be a positive integer'
      );
    }
    assert.equal(lookupCount, 0);
  } finally {
    projects.findByPk = originalFindByPk;
  }
});

test('route ids are rejected before Multer can create upload directories', () => {
  const request = { params: { id: '99999999999999999999' } };
  let nextError;
  validateProjectIdParam(request, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError.statusCode, 400);
  assert.equal(request.projectId, undefined);

  const validRequest = { params: { id: '42' } };
  let validNextError = 'not-called';
  validateProjectIdParam(validRequest, {}, (error) => {
    validNextError = error;
  });
  assert.equal(validNextError, undefined);
  assert.equal(validRequest.projectId, 42);

  for (const layer of projectRouter.stack) {
    if (!layer.route?.path.includes(':id')) continue;
    const handlers = layer.route.stack.map((routeLayer) => routeLayer.handle);
    const validatorIndex = handlers.indexOf(validateProjectIdParam);
    const multerIndex = handlers.findIndex(
      (handler) => handler.name === 'multerMiddleware'
    );

    assert.equal(validatorIndex, 1, `${layer.route.path} validates after auth`);
    if (multerIndex !== -1) {
      assert.ok(
        validatorIndex < multerIndex,
        `${layer.route.path} validates before Multer`
      );
    }
  }
});

test('single-project lookup parses a canonical positive id and preserves stored response data', async () => {
  const originalFindByPk = projects.findByPk;
  let lookedUpId;
  let responseBody;
  const storedData = {
    id: 42,
    role: '["Developer",{"legacy":true}]',
    techStack: '["Node.js"]',
    videos: '[]',
    thumbnailContents: '[]',
    sliderContents: '[]',
    siteLink: 'legacy-custom-value',
  };

  projects.findByPk = async (id) => {
    lookedUpId = id;
    return { get: () => ({ ...storedData }) };
  };

  try {
    await getProjects(
      { body: { mode: 'single', projectId: '42' } },
      { json: (value) => { responseBody = value; } }
    );

    assert.equal(lookedUpId, 42);
    assert.deepEqual(responseBody.result.role, [
      'Developer',
      { legacy: true },
    ]);
    assert.equal(responseBody.result.siteLink, 'legacy-custom-value');
  } finally {
    projects.findByPk = originalFindByPk;
  }
});

test('single-project lookup rejects malformed, unsafe, and out-of-range ids', async () => {
  const originalFindByPk = projects.findByPk;
  let lookupCount = 0;
  projects.findByPk = async () => {
    lookupCount += 1;
    return null;
  };

  try {
    for (const projectId of [0, -1, '01', '1.0', ' 1', '1e2', 2_147_483_648, {}]) {
      await assert.rejects(
        getProjects({ body: { mode: 'single', projectId } }, {}),
        (error) => error.statusCode === 400
      );
    }
    assert.equal(lookupCount, 0);
  } finally {
    projects.findByPk = originalFindByPk;
  }
});

test('project information is Unicode-normalized, trimmed, bounded, and deduplicated', async () => {
  const originalFindByPk = projects.findByPk;
  let updatedData;
  let responseBody;
  const state = {
    id: 7,
    title: 'Old title',
    role: '["Old role"]',
    techStack: '[]',
    videos: '[]',
    thumbnailContents: '[]',
    sliderContents: '[]',
  };
  const project = {
    async update(data) {
      updatedData = { ...data };
      Object.assign(state, data);
    },
    get() {
      return { ...state };
    },
  };
  projects.findByPk = async () => project;

  try {
    await editProjectInfos(
      {
        body: {
          title: '  Ｐroject\t Name  ',
          overview: '  First line\r\nSecond line  ',
          role: [' Lead ', 'Developer', 'Lead'],
          techStack: '[" Node.js ","React","Node.js"]',
          siteLink: ' HTTPS://Example.COM/work ',
          designLink: '',
          codeLink: null,
        },
        params: { id: '7' },
      },
      { json: (value) => { responseBody = value; } }
    );

    assert.deepEqual(updatedData, {
      title: 'Project Name',
      overview: 'First line\nSecond line',
      role: '["Lead","Developer"]',
      techStack: '["Node.js","React"]',
      siteLink: 'https://example.com/work',
      designLink: '',
      codeLink: null,
    });
    assert.deepEqual(responseBody.result.role, ['Lead', 'Developer']);
    assert.deepEqual(responseBody.result.techStack, ['Node.js', 'React']);
  } finally {
    projects.findByPk = originalFindByPk;
  }
});

test('project information rejects unsafe URLs and invalid bounded arrays before lookup', async () => {
  const originalFindByPk = projects.findByPk;
  let lookupCount = 0;
  projects.findByPk = async () => {
    lookupCount += 1;
    return null;
  };

  const invalidBodies = [
    { siteLink: 'javascript:alert(1)' },
    { designLink: 'ftp://example.com/design' },
    { codeLink: 'https://user:secret@example.com/repository' },
    { role: [] },
    { role: [{ label: 'Developer' }] },
    { techStack: Array.from({ length: 65 }, (_, index) => `tech-${index}`) },
    { techStack: ['x'.repeat(121)] },
    { overview: 'x'.repeat(20_001) },
    { overview: '😀'.repeat(15_001) },
    { title: 'line one\nline two' },
  ];

  try {
    for (const body of invalidBodies) {
      await assert.rejects(
        editProjectInfos({ body, params: { id: '1' } }, {}),
        (error) => error.statusCode === 400
      );
    }
    assert.equal(lookupCount, 0);
  } finally {
    projects.findByPk = originalFindByPk;
  }
});

test('banner replacement preserves the existing no-content-id upload contract', async () => {
  const originalFindByPk = projects.findByPk;
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `banner-contract-test-${process.pid}-${Date.now()}`
  );
  const testFile = resolve(testDirectory, 'bannerImg-contract.webp');
  let savedFields;
  let responseBody;
  const state = {
    id: 4,
    bannerImg: null,
    role: '["Developer"]',
    techStack: '[]',
    videos: '[]',
    thumbnailContents: '[]',
    sliderContents: '[]',
  };

  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(testFile, 'test');
  projects.findByPk = async () => ({
    ...state,
    async save(options) {
      savedFields = options.fields;
      state.bannerImg = this.bannerImg;
    },
    get() {
      return { ...state };
    },
  });

  try {
    await editProjectContents(
      {
        body: { mode: 'bannerImg', replaceItem: 'true' },
        files: {
          bannerImg: [
            {
              fieldname: 'bannerImg',
              filename: 'bannerImg-contract.webp',
              mimetype: 'image/webp',
              path: testFile,
              size: 4,
            },
          ],
        },
        params: { id: '4' },
      },
      { json: (value) => { responseBody = value; } }
    );

    assert.deepEqual(savedFields, ['bannerImg']);
    assert.equal(responseBody.succeed, true);
    assert.match(state.bannerImg, /^uploads\//u);
  } finally {
    projects.findByPk = originalFindByPk;
    rmSync(testDirectory, { recursive: true, force: true });
  }
});

test('content append enforces a bounded stored collection and cleans the rejected upload', async () => {
  const originalFindByPk = projects.findByPk;
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `content-limit-test-${process.pid}-${Date.now()}`
  );
  const testFile = resolve(testDirectory, 'videos-limit.mp4');
  const existingVideos = Array.from({ length: 32 }, (_, index) => ({
    id: `video-${index}`,
    url: `uploads/legacy/video-${index}.mp4`,
  }));

  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(testFile, 'test');
  projects.findByPk = async () => ({ videos: JSON.stringify(existingVideos) });

  try {
    await assert.rejects(
      editProjectContents(
        {
          body: { mode: 'videos', replaceItem: 'false' },
          files: {
            videos: [
              {
                fieldname: 'videos',
                filename: 'videos-limit.mp4',
                mimetype: 'video/mp4',
                path: testFile,
                size: 4,
              },
            ],
          },
          params: { id: '4' },
        },
        {}
      ),
      /videos cannot contain more than 32 items/
    );
    assert.equal(existsSync(testFile), false);
  } finally {
    projects.findByPk = originalFindByPk;
    rmSync(testDirectory, { recursive: true, force: true });
  }
});

test('project creation generates a safe collision-resistant slug and ordered record transactionally', async () => {
  const originalTransaction = sequelize.transaction;
  const originalFindOne = projects.findOne;
  const originalCreate = projects.create;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const findOptions = [];
  let createData;
  let createOptions;
  let responseBody;

  sequelize.transaction = async (callback) => callback(transaction);
  projects.findOne = async (options) => {
    findOptions.push(options);
    if (options.where?.value === 'cafe-and-design') return { id: 3 };
    if (options.where?.value) return null;
    return { displayOrder: 4 };
  };
  projects.create = async (data, options) => {
    createData = data;
    createOptions = options;
    return { get: () => ({ id: 9, ...data }) };
  };

  try {
    await createProject(
      {
        body: {
          title: '  Café & Design!!! ',
          subtitle: ' Portfolio work ',
          overview: ' Project overview ',
          role: [' Lead ', 'Lead', 'Developer'],
          date: ' 2026 ',
          category: ' Work ',
          locationYear: ' Dhaka, 2026 ',
        },
      },
      { json: (value) => { responseBody = value; } }
    );

    assert.match(createData.value, /^cafe-and-design-[a-f0-9]{12}$/u);
    assert.equal(createData.displayOrder, 5);
    assert.equal(createData.title, 'Café & Design!!!');
    assert.equal(createData.subtitle, 'Portfolio work');
    assert.equal(createData.category, 'Work');
    assert.equal(createData.role, '["Lead","Developer"]');
    assert.equal(createOptions.transaction, transaction);
    assert.equal(findOptions.at(-1).lock, 'UPDATE');
    assert.deepEqual(responseBody.initialInfos.role, ['Lead', 'Developer']);
  } finally {
    sequelize.transaction = originalTransaction;
    projects.findOne = originalFindOne;
    projects.create = originalCreate;
  }
});

test('project creation rejects empty required arrays without starting a transaction', async () => {
  const originalTransaction = sequelize.transaction;
  let transactionCount = 0;
  sequelize.transaction = async () => {
    transactionCount += 1;
  };

  try {
    await assert.rejects(
      createProject(
        {
          body: {
            title: 'Project',
            subtitle: 'Subtitle',
            overview: 'Overview',
            role: [],
            date: '2026',
            locationYear: 'Dhaka, 2026',
          },
        },
        {}
      ),
      /role must contain at least one item/
    );
    assert.equal(transactionCount, 0);
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('project creation retries the whole transaction after a slug uniqueness race', async () => {
  const originalTransaction = sequelize.transaction;
  const originalFindOne = projects.findOne;
  const originalCreate = projects.create;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let transactionCount = 0;
  let createCount = 0;
  let responseBody;

  sequelize.transaction = async (callback) => {
    transactionCount += 1;
    return callback(transaction);
  };
  projects.findOne = async (options) => {
    if (options.where?.value === 'race-project') {
      return transactionCount > 1 ? { id: 99 } : null;
    }
    if (options.where?.value) return null;
    return null;
  };
  projects.create = async (data) => {
    createCount += 1;
    if (createCount === 1) {
      const error = new Error('duplicate slug');
      error.name = 'SequelizeUniqueConstraintError';
      error.fields = { value: data.value };
      throw error;
    }
    return { get: () => ({ id: 12, ...data }) };
  };

  try {
    await createProject(
      {
        body: {
          title: 'Race Project',
          subtitle: 'Subtitle',
          overview: 'Overview',
          role: ['Developer'],
          date: '2026',
          locationYear: 'Dhaka, 2026',
        },
      },
      { json: (value) => { responseBody = value; } }
    );

    assert.equal(transactionCount, 2);
    assert.equal(createCount, 2);
    assert.match(
      responseBody.initialInfos.value,
      /^race-project-[a-f0-9]{12}$/u
    );
  } finally {
    sequelize.transaction = originalTransaction;
    projects.findOne = originalFindOne;
    projects.create = originalCreate;
  }
});

test('project creation bounds slug race retries and does not retry other constraints', async () => {
  const originalTransaction = sequelize.transaction;
  const originalFindOne = projects.findOne;
  const originalCreate = projects.create;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let transactionCount = 0;
  let failureMode = 'slug';

  sequelize.transaction = async (callback) => {
    transactionCount += 1;
    return callback(transaction);
  };
  projects.findOne = async () => null;
  projects.create = async (data) => {
    const error = new Error('unique constraint');
    error.name = 'SequelizeUniqueConstraintError';
    error.fields =
      failureMode === 'slug'
        ? { value: data.value }
        : { displayOrder: data.displayOrder };
    throw error;
  };
  const request = {
    body: {
      title: 'Race Project',
      subtitle: 'Subtitle',
      overview: 'Overview',
      role: ['Developer'],
      date: '2026',
      locationYear: 'Dhaka, 2026',
    },
  };

  try {
    await assert.rejects(
      createProject(request, {}),
      /Unable to reserve a unique project URL; please retry/u
    );
    assert.equal(transactionCount, 3);

    failureMode = 'other';
    transactionCount = 0;
    await assert.rejects(
      createProject(request, {}),
      (error) =>
        error.name === 'SequelizeUniqueConstraintError' &&
        error.fields.displayOrder === 0
    );
    assert.equal(transactionCount, 1);
  } finally {
    sequelize.transaction = originalTransaction;
    projects.findOne = originalFindOne;
    projects.create = originalCreate;
  }
});

test('project reorder rejects partial and nonexistent project sets before any update', async () => {
  const originalTransaction = sequelize.transaction;
  const originalFindAll = projects.findAll;
  const originalUpdate = projects.update;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let updateCount = 0;

  sequelize.transaction = async (callback) => callback(transaction);
  projects.findAll = async () => [{ id: 1 }, { id: 2 }];
  projects.update = async () => {
    updateCount += 1;
  };

  try {
    await assert.rejects(
      reorderProjects(
        { body: { projectOrders: [{ id: 1, displayOrder: 0 }] } },
        {}
      ),
      /every existing project exactly once/
    );
    await assert.rejects(
      reorderProjects(
        {
          body: {
            projectOrders: [
              { id: 1, displayOrder: 0 },
              { id: 3, displayOrder: 1 },
            ],
          },
        },
        {}
      ),
      /every existing project exactly once/
    );
    assert.equal(updateCount, 0);
  } finally {
    sequelize.transaction = originalTransaction;
    projects.findAll = originalFindAll;
    projects.update = originalUpdate;
  }
});

test('project reorder rejects unsafe ids and unexpected per-item fields before a transaction', async () => {
  const originalTransaction = sequelize.transaction;
  let transactionCount = 0;
  sequelize.transaction = async () => {
    transactionCount += 1;
  };

  const invalidOrders = [
    [{ id: 0, displayOrder: 0 }],
    [{ id: -1, displayOrder: 0 }],
    [{ id: '1', displayOrder: 0 }],
    [{ id: 2_147_483_648, displayOrder: 0 }],
    [{ id: 1, displayOrder: 0, title: 'Injected' }],
  ];

  try {
    for (const projectOrders of invalidOrders) {
      await assert.rejects(
        reorderProjects({ body: { projectOrders } }, {}),
        /Project orders contain invalid values/
      );
    }
    assert.equal(transactionCount, 0);
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('project model independently rejects unsafe URLs and invalid slugs', async () => {
  const validData = {
    title: 'Project',
    value: 'safe-project',
    subtitle: 'Subtitle',
    overview: 'Overview',
    role: '["Developer"]',
    date: '2026',
    locationYear: 'Dhaka, 2026',
    displayOrder: 0,
  };

  await projects.build(validData).validate();
  await assert.rejects(
    projects.build({ ...validData, siteLink: 'javascript:alert(1)' }).validate(),
    /valid HTTP\(S\) URL/
  );
  await assert.rejects(
    projects.build({ ...validData, value: '../unsafe' }).validate(),
    /Validation is/
  );
});
