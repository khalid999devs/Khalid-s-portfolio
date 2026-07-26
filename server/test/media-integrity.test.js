'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectReferences,
  parseArguments,
  parseStoredArray,
  run,
} = require('../scripts/media');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');

const createOutput = () => {
  const chunks = [];
  return { chunks, text: () => chunks.join(''), write: (v) => chunks.push(v) };
};

const createDatabase = (projectRows) => ({
  projects: {
    async findAll() {
      return projectRows;
    },
  },
  sequelize: {
    async close() {},
  },
});

const writeUpload = (relativePath, contents = 'x') => {
  const absolute = path.resolve(UPLOADS_ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
  return absolute;
};

test('media commands are explicit and reject unknown arguments', () => {
  assert.deepEqual(parseArguments(['verify']), { command: 'verify' });
  assert.deepEqual(parseArguments(['orphans']), { command: 'orphans' });
  assert.throws(() => parseArguments(['delete']), /Usage/u);
  assert.throws(() => parseArguments(['verify', '--force']), /Usage/u);
  assert.throws(() => parseArguments([]), /Usage/u);
});

test('stored media arrays tolerate legacy and malformed column values', () => {
  assert.deepEqual(parseStoredArray(null), []);
  assert.deepEqual(parseStoredArray(''), []);
  assert.deepEqual(parseStoredArray('not json'), []);
  assert.deepEqual(parseStoredArray('{"url":"a"}'), []);
  assert.deepEqual(parseStoredArray('[{"url":"a"}]'), [{ url: 'a' }]);
});

test('every media column contributes a traceable reference', () => {
  const references = collectReferences([
    {
      id: 7,
      bannerImg: 'uploads/projects/7/bannerImg/a.webp',
      videos: '[{"url":"uploads/projects/7/videos/v.mp4"}]',
      thumbnailContents: '[{"url":"uploads/projects/7/thumbnailContents/t.webp"}]',
      sliderContents: '[{"noUrl":true}]',
    },
    { id: 8, bannerImg: null, videos: null },
  ]);

  assert.deepEqual(
    references.map((reference) => `${reference.projectId}:${reference.field}`),
    ['7:bannerImg', '7:videos[0]', '7:thumbnailContents[0]']
  );
});

test('verify reports a database reference whose file is absent', async (t) => {
  const marker = `verify-missing-${process.pid}`;
  const present = writeUpload(`${marker}/present.webp`);
  t.after(() =>
    fs.rmSync(path.resolve(UPLOADS_ROOT, marker), {
      force: true,
      recursive: true,
    })
  );

  const output = createOutput();
  const result = await run({
    arguments_: ['verify'],
    loadDatabase: () =>
      createDatabase([
        {
          id: 1,
          bannerImg: `uploads/${marker}/present.webp`,
          thumbnailContents: `[{"url":"uploads/${marker}/gone.webp"}]`,
        },
      ]),
    output,
  });

  assert.equal(fs.existsSync(present), true);
  assert.equal(result.ok, false);
  assert.equal(result.checked, 2);
  assert.deepEqual(
    result.problems.map((problem) => problem.problem),
    ['missing on disk']
  );
  assert.match(output.text(), /project 1 thumbnailContents\[0\]/u);
});

test('verify rejects an empty file rather than serving a broken asset', async (t) => {
  const marker = `verify-empty-${process.pid}`;
  writeUpload(`${marker}/empty.webp`, '');
  t.after(() =>
    fs.rmSync(path.resolve(UPLOADS_ROOT, marker), {
      force: true,
      recursive: true,
    })
  );

  const result = await run({
    arguments_: ['verify'],
    loadDatabase: () =>
      createDatabase([
        { id: 2, bannerImg: `uploads/${marker}/empty.webp` },
      ]),
    output: createOutput(),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.problems.map((problem) => problem.problem),
    ['file is empty']
  );
});

test('verify refuses a stored path that escapes the uploads root', async () => {
  const result = await run({
    arguments_: ['verify'],
    loadDatabase: () =>
      createDatabase([
        { id: 3, bannerImg: 'uploads/../../etc/passwd' },
      ]),
    output: createOutput(),
  });

  assert.equal(result.ok, false);
  assert.match(result.problems[0].problem, /unsafe path/u);
});

test('verify passes when every reference resolves', async (t) => {
  const marker = `verify-ok-${process.pid}`;
  writeUpload(`${marker}/banner.webp`);
  t.after(() =>
    fs.rmSync(path.resolve(UPLOADS_ROOT, marker), {
      force: true,
      recursive: true,
    })
  );

  const output = createOutput();
  const result = await run({
    arguments_: ['verify'],
    loadDatabase: () =>
      createDatabase([
        { id: 4, bannerImg: `uploads/${marker}/banner.webp` },
      ]),
    output,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.match(output.text(), /All referenced media is present and readable/u);
});

test('orphans lists unreferenced files without deleting anything', async (t) => {
  const marker = `orphans-${process.pid}`;
  const referenced = writeUpload(`${marker}/kept.webp`);
  const orphan = writeUpload(`${marker}/stray.webp`);
  t.after(() =>
    fs.rmSync(path.resolve(UPLOADS_ROOT, marker), {
      force: true,
      recursive: true,
    })
  );

  const result = await run({
    arguments_: ['orphans'],
    loadDatabase: () =>
      createDatabase([
        { id: 5, bannerImg: `uploads/${marker}/kept.webp` },
      ]),
    output: createOutput(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.orphans.includes(orphan), true);
  assert.equal(result.orphans.includes(referenced), false);
  // The command is a report, never a mutation: both files must survive it.
  assert.equal(fs.existsSync(orphan), true);
  assert.equal(fs.existsSync(referenced), true);
});

test('a relocated uploads root keeps the same stored paths resolving', () => {
  const volume = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-volume-'));

  try {
    const { resolveUploadsRoot } = require('../utils/uploadPaths');

    assert.equal(resolveUploadsRoot({ UPLOADS_DIR: volume }), volume);
    assert.equal(
      resolveUploadsRoot({}),
      path.resolve(__dirname, '..', 'uploads')
    );
    assert.throws(
      () => resolveUploadsRoot({ UPLOADS_DIR: 'relative/media' }),
      /UPLOADS_DIR must be an absolute path/u
    );
  } finally {
    fs.rmSync(volume, { force: true, recursive: true });
  }
});
