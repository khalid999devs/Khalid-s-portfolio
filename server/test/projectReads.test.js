'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join, dirname } = require('path');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

// The uploads root is fixed when uploadPaths loads, so it is set first.
const scratch = mkdtempSync(join(tmpdir(), 'project-reads-'));
process.env.UPLOADS_DIR = join(scratch, 'uploads');

const db = require('../models');
const router = require('../routers/projects');
const { movie, mp4 } = require('./support/mp4');

test.after(() => rmSync(scratch, { recursive: true, force: true }));

// The project read routes, driven through the real router and controller with
// only the two model queries replaced. No database, no socket.

const png = (width, height) => {
  const bytes = Buffer.alloc(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
};

const store = (stored, bytes) => {
  const path = join(scratch, stored);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
};

store('uploads/projects/3/bannerImg/b.png', png(1500, 400));
store('uploads/projects/3/thumbnailContents/t.png', png(1440, 900));
store('uploads/projects/3/sliderContents/s.png', png(1920, 1080));
store('uploads/projects/3/sliderContents/notes.png', Buffer.from('not an image'.padEnd(64)));
store('uploads/projects/3/videos/v.mp4', mp4(movie({ width: 1272, height: 720 })));
store('uploads/projects/3/videos/notes.mp4', Buffer.from('not a video'.padEnd(64)));

const THUMBNAILS = [
  {
    id: '1@1',
    url: 'uploads/projects/3/thumbnailContents/t.png',
    serverThumb: { fieldname: 'thumbnailContents', size: 24 },
  },
  { id: '2@1', url: 'uploads/projects/3/thumbnailContents/gone.png', serverThumb: {} },
];
const SLIDES = [
  { id: '1@2', url: 'uploads/projects/3/sliderContents/s.png', serverContent: {} },
  { id: '2@2', url: 'uploads/projects/3/sliderContents/notes.png', serverContent: {} },
  { id: '3@2', url: '../../../outside.png', serverContent: {} },
];
const VIDEOS = [
  { id: '1@3', url: 'uploads/projects/3/videos/v.mp4', serverVid: {} },
  { id: '2@3', url: 'uploads/projects/3/videos/notes.mp4', serverVid: {} },
  { id: '3@3', url: 'uploads/projects/3/videos/gone.mp4', serverVid: {} },
];

const ROWS = [
  {
    id: 3,
    title: 'Chemgenie',
    value: 'chemgenie',
    category: 'WebApp',
    subtitle: 'Learning Management System',
    overview: 'An overview.',
    role: JSON.stringify(['Full Stack Developer']),
    siteLink: 'https://example.com',
    designLink: null,
    codeLink: null,
    date: '2024 July',
    locationYear: '2024',
    techStack: JSON.stringify(['React', 'Node']),
    bannerImg: 'uploads/projects/3/bannerImg/b.png',
    videos: JSON.stringify(VIDEOS),
    thumbnailContents: JSON.stringify(THUMBNAILS),
    sliderContents: JSON.stringify(SLIDES),
    displayOrder: 0,
    createdAt: new Date('2025-11-20T19:49:11.000Z'),
    updatedAt: new Date('2025-11-20T19:49:11.000Z'),
  },
  {
    id: 4,
    title: 'No media yet',
    value: 'no-media-yet',
    category: 'Website',
    subtitle: 'Draft',
    overview: 'An overview.',
    role: JSON.stringify(['Developer']),
    siteLink: null,
    designLink: null,
    codeLink: null,
    date: '2025',
    locationYear: '2025',
    techStack: '[]',
    bannerImg: null,
    videos: '[]',
    thumbnailContents: '[]',
    sliderContents: '[]',
    displayOrder: 1,
    createdAt: new Date('2025-11-21T10:00:00.000Z'),
    updatedAt: new Date('2025-11-21T10:00:00.000Z'),
  },
];

// Fresh instances per call, as a query returns: the controller edits them.
const instance = (row, attributes) => {
  const picked = attributes
    ? Object.fromEntries(attributes.map((key) => [key, row[key]]))
    : { ...row };
  return db.projects.build(picked, { isNewRecord: false });
};

db.projects.findAll = async ({ attributes } = {}) =>
  ROWS.map((row) => instance(row, attributes));
db.projects.findOne = async ({ where }) => {
  const row = ROWS.find((candidate) => String(candidate.id) === String(where.id));
  return row ? instance(row) : null;
};

/** Sends one request through the router. `handled` is false if no route took it. */
const send = (method, url, body) =>
  new Promise((resolve) => {
    const req = { method, url, body, headers: {}, signedCookies: {} };
    const res = {
      json: (payload) =>
        resolve({ handled: true, payload: JSON.parse(JSON.stringify(payload)) }),
    };
    router(req, res, (error) => resolve({ handled: false, error }));
  });

test('GET / answers exactly what POST mode "all" answers', async () => {
  const viaGet = await send('GET', '/');
  const viaPost = await send('POST', '/', { mode: 'all' });

  assert.equal(viaGet.handled, true);
  assert.deepEqual(viaGet.payload, viaPost.payload);
  assert.equal(viaGet.payload.succeed, true);
  assert.equal(viaGet.payload.msg, 'Successfully fetched project data!');
  assert.deepEqual(viaGet.payload.result.map((project) => project.id), [3, 4]);
});

test('GET /:id answers exactly what POST mode "single" answers', async () => {
  const viaGet = await send('GET', '/3');
  const viaPost = await send('POST', '/', { mode: 'single', projectId: 3 });

  assert.equal(viaGet.handled, true);
  assert.deepEqual(viaGet.payload, viaPost.payload);
  assert.equal(viaGet.payload.result.title, 'Chemgenie');
  assert.deepEqual(viaGet.payload.result.techStack, ['React', 'Node']);
});

test('an id with no project is the same 404 on both routes', async () => {
  const viaGet = await send('GET', '/999999');
  const viaPost = await send('POST', '/', { mode: 'single', projectId: 999999 });

  for (const { handled, error } of [viaGet, viaPost]) {
    assert.equal(handled, false);
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, 'No project found with that id.');
  }
});

test('the id route takes digits only, so it cannot swallow a named route', async () => {
  for (const url of ['/create', '/reorder', '/3abc', '/abc', '/-3', '/3.5', '/3/extra', '/%20']) {
    const { handled, error } = await send('GET', url);
    assert.equal(handled, false, `GET ${url} must not reach a handler`);
    assert.equal(error, undefined, `GET ${url} must fall through, not fail`);
  }
});

test('the other POST modes answer as they always have', async () => {
  assert.deepEqual((await send('POST', '/', { mode: 'cat' })).payload, {
    succeed: true,
    msg: 'Successfully fetched project data!',
    result: ['WebApp', 'Website'],
  });

  for (const body of [{}, { mode: 'nonsense' }]) {
    assert.deepEqual((await send('POST', '/', body)).payload, {
      succeed: true,
      msg: 'Successfully fetched project data!',
    });
  }

  const missingId = await send('POST', '/', { mode: 'single' });
  assert.equal(missingId.error.statusCode, 400);
  assert.equal(missingId.error.message, 'Project Id must be provided!');
});

test('images gain a width and height; the banner gains a sibling size', async () => {
  const { result } = (await send('GET', '/3')).payload;

  assert.equal(result.bannerImg, 'uploads/projects/3/bannerImg/b.png');
  assert.deepEqual(result.bannerImgSize, { width: 1500, height: 400 });
  assert.deepEqual(result.thumbnailContents[0], { ...THUMBNAILS[0], width: 1440, height: 900 });
  assert.deepEqual(result.sliderContents[0], { ...SLIDES[0], width: 1920, height: 1080 });
});

test('an item whose size cannot be read is returned exactly as stored', async () => {
  const { result } = (await send('GET', '/3')).payload;

  // Missing file, a file that is not an image, a path outside the root.
  assert.deepEqual(result.thumbnailContents[1], THUMBNAILS[1]);
  assert.deepEqual(result.sliderContents[1], SLIDES[1]);
  assert.deepEqual(result.sliderContents[2], SLIDES[2]);
});

test('a video gains its display size; one that cannot be read is left as stored', async () => {
  const { result } = (await send('GET', '/3')).payload;

  assert.deepEqual(result.videos, [
    { ...VIDEOS[0], width: 1272, height: 720 },
    VIDEOS[1],
    VIDEOS[2],
  ]);
});

test('a project with no banner has a null bannerImgSize', async () => {
  const single = (await send('GET', '/4')).payload.result;
  assert.equal(single.bannerImg, null);
  assert.equal(single.bannerImgSize, null);
  assert.deepEqual(single.thumbnailContents, []);
});

test('the list carries the same sizes on its banner and thumbnails', async () => {
  const [first, second] = (await send('GET', '/')).payload.result;

  assert.deepEqual(first.bannerImgSize, { width: 1500, height: 400 });
  assert.deepEqual(first.thumbnailContents, [
    { ...THUMBNAILS[0], width: 1440, height: 900 },
    THUMBNAILS[1],
  ]);
  assert.equal(second.bannerImgSize, null);

  // The list never selected these columns and still must not.
  for (const key of ['sliderContents', 'videos', 'techStack', 'overview']) {
    assert.ok(!(key in first), `${key} should not be in the list`);
  }
});

test('the read routes are public and reach no upload or admin middleware', () => {
  const reads = router.stack
    .map((layer) => layer.route)
    .filter((route) => route.methods.get);

  assert.deepEqual(reads.map((route) => route.path), ['/', '/:id']);
  assert.deepEqual(
    reads.map((route) => route.stack.map((layer) => layer.name)),
    [['getAllProjects'], ['numericId', 'getProjectById']]
  );
});
