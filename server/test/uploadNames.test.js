'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { mkdtempSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

// The uploads root is fixed when uploadPaths loads, so it is set first.
const scratch = mkdtempSync(join(tmpdir(), 'upload-names-'));
process.env.UPLOADS_DIR = join(scratch, 'uploads');

const express = require('express');
const db = require('../models');
const upload = require('../middlewares/uploadFile');
const uploadResume = require('../middlewares/uploadResume');
const validateUploads = require('../middlewares/validateUploads');
const errorHandler = require('../middlewares/errorHandler');
const { uploadResumeFile, downloadResume } = require('../controllers/settings');
const { RESUME_FIELD } = require('../utils/mediaTypes');

// A file's name, from the upload to the name its download is saved under.
// The real middlewares and controllers over a real socket, because the name
// travels as header bytes in both directions. Only the settings row is a
// stand-in, and the download header is read by the client's own reader.

const row = {
  resume: null,
  resumeOriginalName: null,
  async update(values) {
    Object.assign(this, values);
  },
};
db.settings.findAll = async () => [row];

const app = express();
app.patch('/resume', uploadResume.single(RESUME_FIELD), validateUploads, uploadResumeFile);
app.get('/resume', downloadResume);
app.put(
  '/media/:id',
  upload.fields([{ name: 'sliderContents', maxCount: 10 }]),
  validateUploads,
  (req, res) => res.json(req.files.sliderContents.map((file) => file.originalname))
);
app.use(errorHandler);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const PNG = Buffer.alloc(24);
PNG.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
PNG.write('IHDR', 12, 'ascii');

let server;
let base;
let fileNameFrom;

test.before(async () => {
  ({ fileNameFrom } = await import('../../client/src/utils/contentDisposition.js'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.closeAllConnections();
  server.close();
  rmSync(scratch, { recursive: true, force: true });
});

const send = (method, path, field, bytes, name, type) => {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), name);
  return fetch(base + path, { method, body: form });
};

const NAMES = [
  'Khalid Ahammed Resume.pdf',
  'রেজুমে.pdf',
  '履歴書 2026.pdf',
  'Résumé.pdf',
  'Résumé – final.pdf',
  'CV 📄.pdf',
  'My "CV".pdf',
  '50% done.pdf',
  'a%20b.pdf',
  "O'Neil; CV.pdf",
];

test('a resume downloads under the name it was uploaded with', async () => {
  for (const name of NAMES) {
    const uploaded = await send('PATCH', '/resume', RESUME_FIELD, PDF, name, 'application/pdf');
    assert.equal(uploaded.status, 200, name);
    assert.equal((await uploaded.json()).resumeOriginalName, name);

    const download = await fetch(`${base}/resume`);
    assert.equal(download.status, 200, name);
    assert.equal(Buffer.from(await download.arrayBuffer()).equals(PDF), true, name);
    assert.equal(fileNameFrom(download.headers.get('content-disposition')), name);
  }
});

test('a line break in a name cannot break the download header', async () => {
  const name = 'two\nlines.pdf';
  await send('PATCH', '/resume', RESUME_FIELD, PDF, name, 'application/pdf');

  const download = await fetch(`${base}/resume`);
  const header = download.headers.get('content-disposition');

  assert.equal(download.status, 200);
  assert.doesNotMatch(header, /[\r\n]/);
  assert.equal(fileNameFrom(header), name);
});

test('project media keeps a name in any script', async () => {
  for (const name of ['স্ক্রিনশট ১.png', 'Élan – écran.png', '截图.png', 'plain.png']) {
    const response = await send('PUT', '/media/7', 'sliderContents', PNG, name, 'image/png');
    assert.equal(response.status, 200, name);
    assert.deepEqual(await response.json(), [name]);
  }
});

test('the reader takes the real name over the fallback, in every form a server sends', () => {
  const forms = [
    ['attachment; filename=plain.pdf', 'plain.pdf'],
    ['attachment; filename="semi;colon.pdf"', 'semi;colon.pdf'],
    ['attachment; filename="a \\"quoted\\" word.pdf"', 'a "quoted" word.pdf'],
    ['attachment; filename="50% done.pdf"', '50% done.pdf'],
    ["attachment; filename*=UTF-8''%E0%A6%95.pdf", 'ক.pdf'],
    ["attachment; filename=\"?.pdf\"; filename*=UTF-8''%E0%A6%95.pdf", 'ক.pdf'],
    ["attachment; filename*=utf-8''%E0%A6%95.pdf; filename=\"?.pdf\"", 'ক.pdf'],
    // An extended form that is not valid percent-encoding is passed over.
    ["attachment; filename=\"fallback.pdf\"; filename*=UTF-8''%E0%A6", 'fallback.pdf'],
    ['inline', null],
    ['', null],
    [undefined, null],
  ];

  for (const [header, expected] of forms) {
    assert.equal(fileNameFrom(header), expected, String(header));
  }
});
