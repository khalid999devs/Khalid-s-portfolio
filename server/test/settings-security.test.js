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
