'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveStoredUploadPath, UPLOADS_ROOT } = require('../utils/uploadPaths');

/**
 * The containment boundary between a database string and the filesystem.
 * `deleteFile` unlinks whatever this returns, so anything that escapes the
 * uploads root here is an arbitrary file deletion.
 */
test('rejects paths that escape the uploads root', () => {
  const escapes = [
    '../index.js',
    '../../../../etc/passwd',
    'uploads/../../index.js',
    'uploads/projects/../../../index.js',
    'uploads/projects/1/../../../../.env',
    '/etc/passwd',
    '/Users/someone/.ssh/id_rsa',
    'C:\\Windows\\system32\\config\\sam',
    'uploads\\..\\..\\index.js',
  ];

  for (const input of escapes) {
    assert.equal(resolveStoredUploadPath(input), null, `should reject ${input}`);
  }
});

test('rejects a NUL byte, which can truncate the path at the syscall', () => {
  assert.equal(resolveStoredUploadPath('uploads/a\u0000/../../../etc/passwd'), null);
  assert.equal(resolveStoredUploadPath('uploads/ok.png\u0000.txt'), null);
});

test('rejects values that are not usable strings', () => {
  for (const input of [null, undefined, '', '   ', 42, {}, [], true, Symbol('x')]) {
    assert.equal(resolveStoredUploadPath(input), null);
  }
});

test('accepts real stored paths, including awkward legacy directory names', () => {
  const stored = [
    'uploads/projects/chemgenie/bannerImg/banner.png',
    "uploads/projects/khalid's-portfolio/sliderContents/s.png",
    'uploads/projects/golden-dot-properties-ltd./thumbnailContents/t.png',
    'uploads/projects/12/videos/videos_abc123.mp4',
    'uploads/assets/Resume_Khalid_Ahammed.pdf',
  ];

  for (const input of stored) {
    const resolved = resolveStoredUploadPath(input);
    assert.ok(resolved, `should accept ${input}`);
    assert.ok(
      resolved.startsWith(UPLOADS_ROOT),
      `${input} must resolve inside the uploads root`
    );
  }
});

test('a path that resolves exactly to the root is not a file to delete', () => {
  // `uploads/` alone strips to '' and resolves to the root itself. Accepting it
  // would hand a directory to unlink.
  const resolved = resolveStoredUploadPath('uploads/');
  assert.ok(resolved === null || resolved === UPLOADS_ROOT);
});
