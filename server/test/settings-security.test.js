const assert = require('node:assert/strict');
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  isResumeAvailable,
  resolveResumeFilePath,
} = require('../controllers/settings');
const {
  normalizeTechnologies,
} = require('../utils/technologySettings');

test('technology settings are trimmed, bounded, and normalized', () => {
  const technologies = normalizeTechnologies({
    frontend: [' React ', 'Tailwind CSS'],
    backend: ['Node.js'],
  });

  assert.equal(Object.getPrototypeOf(technologies), null);
  assert.deepEqual({ ...technologies }, {
    frontend: ['React', 'Tailwind CSS'],
    backend: ['Node.js'],
  });
});

test('technology settings reject arrays, invalid groups, and non-string items', () => {
  assert.throws(() => normalizeTechnologies([]), /must be an object/);
  assert.throws(
    () => normalizeTechnologies({ constructor: ['unsafe'] }),
    /group names are invalid/
  );
  assert.throws(
    () => normalizeTechnologies({ frontend: [{ name: 'React' }] }),
    /names must be strings/
  );
});

test('technology settings reject empty and duplicate values', () => {
  assert.throws(
    () => normalizeTechnologies({ frontend: ['React', ' react '] }),
    /Duplicate technology/
  );
  assert.throws(
    () => normalizeTechnologies({ frontend: [''] }),
    /between 1 and 100 characters/
  );
});

test('technology settings accept a stored JSON representation', () => {
  const technologies = normalizeTechnologies(
    JSON.stringify({ database: ['MySQL'] })
  );

  assert.deepEqual({ ...technologies }, { database: ['MySQL'] });
});

test('technology settings normalize Unicode and reject control characters', () => {
  const technologies = normalizeTechnologies({
    'Cafe\u0301': [' Re\u0301act '],
  });

  assert.deepEqual({ ...technologies }, { Café: ['Réact'] });
  assert.throws(
    () => normalizeTechnologies({ 'front\nend': ['React'] }),
    /group names are invalid/
  );
  assert.throws(
    () => normalizeTechnologies({ frontend: ['React\u0000JS'] }),
    /between 1 and 100 characters/
  );
});

test('technology settings reject a serialized value larger than MySQL TEXT', () => {
  const technologies = Object.fromEntries(
    Array.from({ length: 50 }, (_, groupIndex) => [
      `group-${groupIndex}`,
      Array.from(
        { length: 100 },
        (_, itemIndex) => `technology-${groupIndex}-${itemIndex}-xxxxxxxx`
      ),
    ])
  );

  assert.throws(
    () => normalizeTechnologies(technologies),
    /storage limit/
  );
});

test('resume availability requires a readable regular PDF with a PDF signature', async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'portfolio-resume-test-')
  );
  const validResume = path.join(directory, 'resume.pdf');
  const spoofedResume = path.join(directory, 'spoofed.pdf');
  const wrongExtension = path.join(directory, 'resume.txt');
  const directoryWithPdfName = path.join(directory, 'folder.pdf');

  try {
    await writeFile(validResume, '%PDF-1.7\nvalid test document');
    await writeFile(spoofedResume, '<html>not a PDF</html>');
    await writeFile(wrongExtension, '%PDF-1.7\nwrong extension');
    await mkdir(directoryWithPdfName);

    assert.equal(
      await isResumeAvailable({ RESUME_FILE_PATH: validResume }),
      true
    );
    assert.equal(
      await isResumeAvailable({ RESUME_FILE_PATH: spoofedResume }),
      false
    );
    assert.equal(
      await isResumeAvailable({ RESUME_FILE_PATH: wrongExtension }),
      false
    );
    assert.equal(
      await isResumeAvailable({
        RESUME_FILE_PATH: directoryWithPdfName,
      }),
      false
    );
    assert.equal(
      await isResumeAvailable({
        RESUME_FILE_PATH: path.join(directory, 'missing.pdf'),
      }),
      false
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('resume path resolution preserves an explicitly configured absolute path', () => {
  const resumePath = path.join(tmpdir(), 'portfolio-resume.pdf');
  assert.equal(
    resolveResumeFilePath({ RESUME_FILE_PATH: ` ${resumePath} ` }),
    resumePath
  );
});
