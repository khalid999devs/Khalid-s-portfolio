const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeTechnologies } = require('../controllers/settings');

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
