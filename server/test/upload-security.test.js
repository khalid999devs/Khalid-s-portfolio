const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const test = require('node:test');

const upload = require('../middlewares/uploadFile');
const deleteFile = require('../utils/deleteFile');
const {
  UPLOADS_ROOT,
  resolveStoredUploadPath,
  toStoredUploadPath,
} = require('../utils/uploadPaths');

test('legacy uploads/... database paths remain compatible', () => {
  assert.equal(
    resolveStoredUploadPath(
      'uploads/projects/legacy-project/bannerImg/banner.webp'
    ),
    resolve(
      UPLOADS_ROOT,
      'projects/legacy-project/bannerImg/banner.webp'
    )
  );
});

test('upload paths reject absolute, backslash, traversal, and non-upload paths', () => {
  const invalidPaths = [
    '/etc/passwd',
    'C:\\Windows\\system.ini',
    'uploads\\projects\\1\\bannerImg\\banner.webp',
    'uploads/../index.js',
    'uploads/projects/../../index.js',
    'server/uploads/projects/1/bannerImg/banner.webp',
    'uploads//projects/1/bannerImg/banner.webp',
  ];

  invalidPaths.forEach((invalidPath) => {
    assert.throws(() => resolveStoredUploadPath(invalidPath));
  });
});

test('absolute Multer paths are converted to public stored paths only inside uploads', () => {
  assert.equal(
    toStoredUploadPath(
      resolve(UPLOADS_ROOT, 'projects/42/videos/example.mp4')
    ),
    'uploads/projects/42/videos/example.mp4'
  );
  assert.equal(
    toStoredUploadPath('uploads/projects/legacy/videos/example.mp4'),
    'uploads/projects/legacy/videos/example.mp4'
  );
  assert.throws(() => toStoredUploadPath(resolve(UPLOADS_ROOT, '../index.js')));
  assert.throws(() => toStoredUploadPath('../outside.txt'));
});

test('legacy relative Multer paths are independent of process cwd', () => {
  const helperPath = require.resolve('../utils/uploadPaths');
  const repositoryRoot = resolve(__dirname, '../..');
  const script = [
    `const { toStoredUploadPath } = require(${JSON.stringify(helperPath)});`,
    "process.stdout.write(toStoredUploadPath('uploads/projects/7/bannerImg/example.webp'));",
  ].join('');

  const storedPath = execFileSync(process.execPath, ['-e', script], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(
    storedPath,
    'uploads/projects/7/bannerImg/example.webp'
  );
});

test('deleteFile removes an in-root upload and never accepts an absolute path', async () => {
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `delete-file-test-${process.pid}-${Date.now()}`
  );
  const testFile = join(testDirectory, 'example.webp');

  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(testFile, 'test');

  try {
    const storedPath = toStoredUploadPath(testFile);
    assert.equal(await deleteFile(storedPath), true);
    assert.equal(existsSync(testFile), false);
    assert.equal(await deleteFile(storedPath), false);
    await assert.rejects(deleteFile(testFile));
  } finally {
    rmSync(testDirectory, { recursive: true, force: true });
  }
});

test('deleteFile rejects an upload path that escapes through a symlink', async () => {
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `symlink-test-${process.pid}-${Date.now()}`
  );
  const outsideDirectory = mkdtempSync(join(tmpdir(), 'portfolio-upload-test-'));
  const outsideFile = join(outsideDirectory, 'outside.txt');
  const linkPath = join(testDirectory, 'outside-link.txt');

  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(outsideFile, 'must survive');
  symlinkSync(outsideFile, linkPath);

  try {
    await assert.rejects(deleteFile(toStoredUploadPath(linkPath)));
    assert.equal(existsSync(outsideFile), true);
    assert.equal(existsSync(linkPath), true);
  } finally {
    rmSync(testDirectory, { recursive: true, force: true });
    rmSync(outsideDirectory, { recursive: true, force: true });
  }
});

test('upload policy is exact, field-aware, and does not trust active extensions', () => {
  assert.equal(upload.FILE_POLICIES.bannerImg['image/webp'], '.webp');
  assert.equal(upload.FILE_POLICIES.videos['video/mp4'], '.mp4');
  assert.equal(upload.FILE_POLICIES.bannerImg['text/html'], undefined);
  assert.equal(upload.FILE_POLICIES.videos['image/jpeg'], undefined);

  assert.equal(upload.getProjectUploadKey({ params: { id: '123' } }), '123');
  assert.throws(() =>
    upload.getProjectUploadKey({ params: { id: '../outside' } })
  );
  assert.throws(() =>
    upload.getProjectUploadKey({ params: { id: 'project-title' } })
  );
});

test('uploaded media must match its declared magic signature', async () => {
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `signature-test-${process.pid}-${Date.now()}`
  );
  mkdirSync(testDirectory, { recursive: true });

  const samples = [
    {
      mimetype: 'image/png',
      name: 'valid.png',
      bytes: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]),
      expected: true,
    },
    {
      mimetype: 'video/mp4',
      name: 'valid.mp4',
      bytes: Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0]),
      expected: true,
    },
    {
      mimetype: 'image/png',
      name: 'spoofed.png',
      bytes: Buffer.from('<html><script>alert(1)</script></html>'),
      expected: false,
    },
  ];

  try {
    for (const sample of samples) {
      const filePath = resolve(testDirectory, sample.name);
      writeFileSync(filePath, sample.bytes);
      assert.equal(
        await upload.validateFileSignature({
          mimetype: sample.mimetype,
          path: filePath,
        }),
        sample.expected
      );
    }
  } finally {
    rmSync(testDirectory, { recursive: true, force: true });
  }
});

test('a spoofed file rejects the request and all request files are removed', async () => {
  const testDirectory = resolve(
    UPLOADS_ROOT,
    `signature-cleanup-test-${process.pid}-${Date.now()}`
  );
  const validFile = resolve(testDirectory, 'valid.png');
  const spoofedFile = resolve(testDirectory, 'spoofed.png');
  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(
    validFile,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  writeFileSync(spoofedFile, Buffer.from('<html>not an image</html>'));

  try {
    await assert.rejects(
      upload.validateUploadedFiles(
        {
          files: {
            sliderContents: [
              { mimetype: 'image/png', path: validFile },
              { mimetype: 'image/png', path: spoofedFile },
            ],
          },
        },
        {},
        () => {
          throw new Error('next must not run for an invalid upload');
        }
      ),
      /does not match its declared media type/
    );

    assert.equal(existsSync(validFile), false);
    assert.equal(existsSync(spoofedFile), false);
  } finally {
    rmSync(testDirectory, { recursive: true, force: true });
  }
});
