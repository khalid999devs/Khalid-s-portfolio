const assert = require('node:assert/strict');
const test = require('node:test');

const { projects } = require('../models');
const {
  getPublicProject,
  getPublicProjects,
  projectForPublicResponse,
} = require('../controllers/projects');

const createProject = (overrides = {}) => ({
  id: 4,
  title: 'Secure portfolio',
  value: 'secure-portfolio',
  bannerImg: 'uploads/projects/4/bannerImg/banner.webp',
  category: 'web',
  subtitle: 'A project',
  overview: 'Project overview',
  role: '["Engineering"]',
  siteLink: 'https://example.test/',
  designLink: null,
  codeLink: 'https://github.com/example/project',
  date: '2026',
  locationYear: 'Dhaka / 2026',
  techStack: '["React"]',
  videos: '[]',
  thumbnailContents: JSON.stringify([
    {
      id: 'first',
      url: 'uploads/projects/4/thumbnailContents/first.webp',
      width: 1280,
      height: 720,
      serverThumb: {
        filename: 'private-server-name.webp',
        path: 'uploads/projects/4/thumbnailContents/first.webp',
        size: 1234,
      },
    },
    {
      id: 'second',
      url: 'uploads/projects/4/thumbnailContents/second.webp',
    },
  ]),
  sliderContents: '[]',
  displayOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  internalNotes: 'must never enter a response',
  ...overrides,
});

const createResponse = () => {
  const headers = new Map();
  let body;

  return {
    get body() {
      return body;
    },
    headers,
    json(value) {
      body = value;
    },
    set(name, value) {
      headers.set(name.toLowerCase(), value);
    },
  };
};

test('public project DTO allowlists fields and strips server-side upload metadata', () => {
  const result = projectForPublicResponse(createProject());

  assert.equal(Object.hasOwn(result, 'internalNotes'), false);
  assert.equal(Object.hasOwn(result, 'createdAt'), false);
  assert.equal(Object.hasOwn(result, 'updatedAt'), false);
  assert.deepEqual(result.thumbnailContents[0], {
    id: 'first',
    url: 'uploads/projects/4/thumbnailContents/first.webp',
    width: 1280,
    height: 720,
  });
  assert.equal(Object.hasOwn(result.thumbnailContents[0], 'serverThumb'), false);
});

test('public project catalog returns only its first thumbnail and requires cache revalidation', async () => {
  const originalFindAll = projects.findAll;
  const response = createResponse();
  let query;
  projects.findAll = async (options) => {
    query = options;
    return [createProject()];
  };

  try {
    await getPublicProjects({}, response);
  } finally {
    projects.findAll = originalFindAll;
  }

  assert.deepEqual(query.order, [
    ['displayOrder', 'ASC'],
    ['id', 'ASC'],
  ]);
  assert.equal(query.attributes.includes('overview'), false);
  assert.equal(response.body.result[0].thumbnailContents.length, 1);
  assert.equal(
    response.headers.get('cache-control'),
    'public, no-cache, must-revalidate'
  );
});

test('public project detail also requires cache revalidation', async () => {
  const originalFindByPk = projects.findByPk;
  const response = createResponse();
  projects.findByPk = async () => createProject();

  try {
    await getPublicProject({ projectId: 4 }, response);
  } finally {
    projects.findByPk = originalFindByPk;
  }

  assert.equal(
    response.headers.get('cache-control'),
    'public, no-cache, must-revalidate'
  );
});

test('missing public project returns 404 without marking the error cacheable', async () => {
  const originalFindByPk = projects.findByPk;
  const response = createResponse();
  projects.findByPk = async () => null;

  try {
    await assert.rejects(
      getPublicProject({ projectId: 999 }, response),
      (error) => error.statusCode === 404
    );
  } finally {
    projects.findByPk = originalFindByPk;
  }

  assert.equal(response.headers.has('cache-control'), false);
});
