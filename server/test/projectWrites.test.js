'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
  chmodSync,
  rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, dirname } = require('path');
const { sign } = require('jsonwebtoken');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

// The uploads root is fixed when uploadPaths loads, so it is set first.
const scratch = mkdtempSync(join(tmpdir(), 'project-writes-'));
process.env.UPLOADS_DIR = join(scratch, 'uploads');

const express = require('express');
const cookieParser = require('cookie-parser');
const env = require('../config/env');
const db = require('../models');
const router = require('../routers/projects');
const upload = require('../middlewares/uploadFile');
const errorHandler = require('../middlewares/errorHandler');
const { attachTokenToResponse } = require('../utils/createToken');

// The admin's project routes: the real router, middlewares and controllers over
// a real socket, because an upload is a stream. Only the table is a stand-in.

const table = new Map();
const queries = [];

const instance = (row) => db.projects.build({ ...row }, { isNewRecord: false });

db.projects.findOne = async ({ where }) => {
  queries.push(['findOne', where.id]);
  const row = table.get(String(where.id));
  return row ? instance(row) : null;
};
db.projects.update = async (values, { where }) => {
  queries.push(['update', where.id]);
  Object.assign(table.get(String(where.id)), values);
  return [1];
};
// What save() and destroy() come down to.
db.projects.prototype.save = async function save() {
  queries.push(['save', this.id]);
  Object.assign(table.get(String(this.id)), this.get());
  return this;
};
db.projects.prototype.destroy = async function destroy() {
  queries.push(['destroy', this.id]);
  table.delete(String(this.id));
};

const app = express();
app.use(express.json());
app.use(cookieParser(env.cookieSecret));
// A session cookie, issued the way the login route issues one.
app.get('/session', (req, res) => {
  const token = sign({ id: 1, role: 'admin' }, env.adminSecret, { algorithm: 'HS256' });
  attachTokenToResponse('token', { res, token });
  res.end();
});
app.use('/api/projects', router);
// The storage on its own, as a route that forgot the id check would use it.
app.put('/unchecked/:id', upload.fields([{ name: 'bannerImg', maxCount: 1 }]), (req, res) =>
  res.json({ stored: true })
);
app.use(errorHandler);

const PNG = Buffer.alloc(24);
PNG.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
PNG.write('IHDR', 12, 'ascii');
const MP4 = Buffer.alloc(24);
MP4.writeUInt32BE(24, 0);
MP4.write('ftypisom', 4, 'ascii');

const uploads = (...parts) => join(scratch, 'uploads', ...parts);
const onDisk = (stored) => existsSync(join(scratch, stored));

const store = (stored, bytes = PNG) => {
  const path = join(scratch, stored);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return stored;
};

// Every file under the uploads root, as stored paths.
const stored = () =>
  existsSync(uploads())
    ? readdirSync(uploads(), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name).slice(scratch.length + 1))
        .sort()
    : [];

const item = (id, url) => ({ id, url, serverContent: {} });

const seed = (id, media = {}) => {
  table.set(String(id), {
    id,
    title: `Project ${id}`,
    value: `project-${id}`,
    category: 'WebApp',
    subtitle: 'A subtitle',
    overview: 'An overview.',
    role: JSON.stringify(['Developer']),
    siteLink: null,
    designLink: null,
    codeLink: null,
    date: '2026',
    locationYear: '2026',
    techStack: '[]',
    bannerImg: null,
    videos: '[]',
    thumbnailContents: '[]',
    sliderContents: '[]',
    displayOrder: 0,
    ...media,
  });
  return table.get(String(id));
};

let server;
let base;
let cookie;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  const session = await fetch(`${base}/session`);
  cookie = session.headers.getSetCookie()[0].split(';')[0];
});

test.beforeEach(() => {
  table.clear();
  queries.length = 0;
  rmSync(uploads(), { recursive: true, force: true });
});

test.after(() => {
  server.closeAllConnections();
  server.close();
  rmSync(scratch, { recursive: true, force: true });
});

const form = (files = {}, fields = {}) => {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  for (const [name, list] of Object.entries(files)) {
    for (const bytes of list) body.append(name, new Blob([bytes]), `${name}.bin`);
  }
  return body;
};

const send = async (method, path, body, { signedIn = true } = {}) => {
  const json = body !== undefined && !(body instanceof FormData);
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(signedIn ? { cookie } : {}),
      ...(json ? { 'content-type': 'application/json' } : {}),
    },
    body: json ? JSON.stringify(body) : body,
  });
  return { status: response.status, body: await response.json() };
};

const BAD_ID = { status: 400, body: { msg: 'Please Enter the correct project Id!' } };

// Not ids: words, signs, fractions, and the spellings Number() or MySQL would
// still read as project 7.
const MALFORMED = [
  'abc',
  '7abc',
  '-7',
  '+7',
  '7.0',
  '7e0',
  '0x7',
  '007',
  '%207',
  '7%20',
  '0',
  '99999999999999999999',
];

const ROUTES_BY_ID = [
  ['PUT', '/update-content', () => form({ bannerImg: [PNG] })],
  ['PUT', '/update-content', () => ({ siteLink: 'https://example.com' })],
  ['PATCH', '/edit-contents', () => form({ bannerImg: [PNG] }, { mode: 'bannerImg' })],
  ['PATCH', '/edit-infos', () => ({ title: 'Renamed' })],
  ['PATCH', '/delete-contents', () => ({ mode: 'bannerImg' })],
  ['DELETE', '/delete', () => undefined],
];

test('a malformed project id is refused before anything is read or written', async () => {
  for (const [method, path, body] of ROUTES_BY_ID) {
    for (const id of MALFORMED) {
      seed(7, { bannerImg: store('uploads/projects/7/bannerImg/kept.png') });
      queries.length = 0;

      const answer = await send(method, `/api/projects${path}/${id}`, body());
      const what = `${method} ${path}/${id}`;

      assert.deepEqual(answer, BAD_ID, what);
      assert.deepEqual(queries, [], `${what} reached the table`);
      assert.deepEqual(stored(), ['uploads/projects/7/bannerImg/kept.png'], what);
      assert.equal(table.has('7'), true, what);
    }
  }
});

test('the refusal reaches the caller however large the upload is', async () => {
  const large = Buffer.alloc(12 * 1024 * 1024);
  PNG.copy(large);

  const answer = await send('PUT', '/api/projects/update-content/abc', form({ bannerImg: [large] }));

  assert.deepEqual(answer, BAD_ID);
  assert.deepEqual(stored(), []);
});

test('the upload storage refuses a malformed id by itself', async () => {
  for (const id of MALFORMED) {
    const answer = await send('PUT', `/unchecked/${id}`, form({ bannerImg: [PNG] }));

    assert.equal(answer.status, 400, id);
    assert.deepEqual(stored(), [], id);
  }
});

test('a well-formed id reaches its route, and an id with no project is a 400', async () => {
  seed(7);

  const renamed = await send('PATCH', '/api/projects/edit-infos/7', { title: 'Renamed' });
  assert.equal(renamed.status, 200);
  assert.equal(table.get('7').title, 'Renamed');

  const missing = await send('PUT', '/api/projects/update-content/8', form({ bannerImg: [PNG] }));
  assert.deepEqual(missing, BAD_ID);
  assert.deepEqual(stored(), []);
});

test('without a session the answer is 403, whatever the id', async () => {
  for (const [method, path, body] of ROUTES_BY_ID) {
    for (const id of ['7', 'abc']) {
      const answer = await send(method, `/api/projects${path}/${id}`, body(), { signedIn: false });

      assert.equal(answer.status, 403, `${method} ${path}/${id}`);
      assert.deepEqual(queries, []);
      assert.deepEqual(stored(), []);
    }
  }
});

test('a content update removes the media it replaces, and only that', async () => {
  const before = seed(7, {
    bannerImg: store('uploads/projects/7/bannerImg/old.png'),
    sliderContents: JSON.stringify([
      item('1@1', store('uploads/projects/7/sliderContents/old-a.png')),
      item('2@1', store('uploads/Legacy Title/sliderContents/old-b.png')),
    ]),
    thumbnailContents: JSON.stringify([
      item('1@2', store('uploads/projects/7/thumbnailContents/kept.png')),
    ]),
    videos: JSON.stringify([item('1@3', store('uploads/projects/7/videos/kept.mp4', MP4))]),
  });
  const { thumbnailContents, videos } = before;
  // Another project's files are never this request's to remove.
  seed(8, { bannerImg: store('uploads/projects/8/bannerImg/other.png') });

  const answer = await send(
    'PUT',
    '/api/projects/update-content/7',
    form({ bannerImg: [PNG], sliderContents: [PNG, PNG] })
  );
  assert.equal(answer.status, 200);

  const row = table.get('7');
  const slides = JSON.parse(row.sliderContents).map((slide) => slide.url);

  assert.match(row.bannerImg, /^uploads\/projects\/7\/bannerImg\/bannerImg_[0-9a-f]{32}\.png$/);
  assert.equal(slides.length, 2);
  assert.equal(row.thumbnailContents, thumbnailContents);
  assert.equal(row.videos, videos);

  assert.deepEqual(
    stored(),
    [
      row.bannerImg,
      ...slides,
      'uploads/projects/7/thumbnailContents/kept.png',
      'uploads/projects/7/videos/kept.mp4',
      'uploads/projects/8/bannerImg/other.png',
    ].sort()
  );
});

test('every media field is replaced the same way', async () => {
  seed(7, {
    videos: JSON.stringify([item('1@1', store('uploads/projects/7/videos/old.mp4', MP4))]),
    thumbnailContents: JSON.stringify([
      item('1@2', store('uploads/projects/7/thumbnailContents/old.png')),
    ]),
  });

  const answer = await send(
    'PUT',
    '/api/projects/update-content/7',
    form({ videos: [MP4], thumbnailContents: [PNG] })
  );
  assert.equal(answer.status, 200);

  const row = table.get('7');
  const now = [...JSON.parse(row.videos), ...JSON.parse(row.thumbnailContents)].map((x) => x.url);

  assert.equal(now.length, 2);
  assert.deepEqual(stored(), now.sort());
  // The answer carries each list as a list, as the edit route's does.
  for (const field of ['videos', 'thumbnailContents']) {
    assert.deepEqual(answer.body.result[field], JSON.parse(row[field]), field);
  }
});

test('an update with no files removes nothing', async () => {
  seed(7, { bannerImg: store('uploads/projects/7/bannerImg/kept.png') });

  const answer = await send('PUT', '/api/projects/update-content/7', {
    siteLink: 'https://example.com',
    techStack: ['React'],
  });

  assert.equal(answer.status, 200);
  assert.equal(table.get('7').siteLink, 'https://example.com');
  assert.deepEqual(stored(), ['uploads/projects/7/bannerImg/kept.png']);
});

test('when the row cannot be saved, the old media stays and the new is discarded', async (t) => {
  seed(7, {
    bannerImg: store('uploads/projects/7/bannerImg/old.png'),
    sliderContents: JSON.stringify([
      item('1@1', store('uploads/projects/7/sliderContents/old.png')),
    ]),
  });
  t.mock.method(db.projects, 'update', async () => {
    throw new Error('connection lost');
  });
  t.mock.method(console, 'error', () => {});

  const answer = await send(
    'PUT',
    '/api/projects/update-content/7',
    form({ bannerImg: [PNG], sliderContents: [PNG] })
  );

  assert.equal(answer.status, 500);
  assert.equal(table.get('7').bannerImg, 'uploads/projects/7/bannerImg/old.png');
  assert.deepEqual(stored(), [
    'uploads/projects/7/bannerImg/old.png',
    'uploads/projects/7/sliderContents/old.png',
  ]);
});

test('a row that points outside the uploads folder removes nothing there', async () => {
  const outside = join(scratch, 'outside.png');
  writeFileSync(outside, PNG);
  seed(7, {
    bannerImg: '../outside.png',
    sliderContents: JSON.stringify([item('1@1', outside), item('2@1', null), 'not an item']),
    thumbnailContents: 'not json',
  });

  const answer = await send(
    'PUT',
    '/api/projects/update-content/7',
    form({ bannerImg: [PNG], sliderContents: [PNG], thumbnailContents: [PNG] })
  );

  assert.equal(answer.status, 200);
  assert.equal(existsSync(outside), true);
  assert.equal(stored().length, 3);
});

// Root ignores directory permissions, so there is nothing to observe as root.
const canDenyUnlink = process.platform !== 'win32' && process.getuid?.() !== 0;

test(
  'a replaced file that will not delete is logged, and the update still stands',
  { skip: !canDenyUnlink },
  async (t) => {
    const locked = dirname(join(scratch, store('uploads/locked/old.png')));
    seed(7, { bannerImg: 'uploads/locked/old.png' });
    chmodSync(locked, 0o555);
    t.after(() => chmodSync(locked, 0o755));
    const logged = t.mock.method(console, 'error', () => {});

    const answer = await send('PUT', '/api/projects/update-content/7', form({ bannerImg: [PNG] }));

    assert.equal(answer.status, 200);
    const { bannerImg } = table.get('7');
    assert.notEqual(bannerImg, 'uploads/locked/old.png');
    assert.equal(onDisk(bannerImg), true);
    assert.equal(logged.mock.callCount(), 1);
    assert.match(logged.mock.calls[0].arguments.join(' '), /uploads\/locked\/old\.png/);
  }
);
