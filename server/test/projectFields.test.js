'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EDITABLE_INFO_FIELDS,
  EDITABLE_CONTENT_FIELDS,
  pickProjectFields,
} = require('../utils/projectFields');

const rejects = (body, allowed = EDITABLE_INFO_FIELDS) =>
  assert.throws(() => pickProjectFields(body, allowed), { statusCode: 400 });

/**
 * The media columns are the ones that matter most: their values are handed to
 * the filesystem by the delete routes, so being able to write them is what
 * turned mass assignment into arbitrary file deletion.
 */
test('media columns cannot be written through either route', () => {
  for (const field of ['bannerImg', 'videos', 'thumbnailContents', 'sliderContents']) {
    rejects({ [field]: '../../../../etc/passwd' });
    rejects({ [field]: '[]' }, EDITABLE_CONTENT_FIELDS);
  }
});

test('identity, ordering and timestamp columns cannot be written', () => {
  for (const field of ['id', 'value', 'displayOrder', 'createdAt', 'updatedAt']) {
    rejects({ [field]: 'x' });
  }
});

test('unknown fields are rejected rather than silently dropped', () => {
  rejects({ notAColumn: 'x' });
  // A rejection names the offending field so a client bug is diagnosable.
  assert.throws(() => pickProjectFields({ nope: 1 }, EDITABLE_INFO_FIELDS), /nope/);
});

test('array fields must be arrays of non-empty strings', () => {
  rejects({ role: '' });
  rejects({ role: [''] });
  rejects({ role: ['  '] });
  rejects({ role: [1] });
  rejects({ role: [null] });
  rejects({ role: {} });
  rejects({ techStack: 'React' });
});

test('array fields are stored JSON-encoded and trimmed', () => {
  const result = pickProjectFields(
    { role: [' Developer ', 'Designer'] },
    EDITABLE_INFO_FIELDS
  );
  assert.equal(result.role, JSON.stringify(['Developer', 'Designer']));
});

test('a JSON-encoded array is accepted, since multipart sends strings', () => {
  const result = pickProjectFields(
    { techStack: '["React","Node"]' },
    EDITABLE_INFO_FIELDS
  );
  assert.equal(result.techStack, JSON.stringify(['React', 'Node']));
});

test('optional links accept null to clear them', () => {
  const result = pickProjectFields({ siteLink: null }, EDITABLE_INFO_FIELDS);
  assert.equal(result.siteLink, null);
});

test('scalar fields must be strings', () => {
  rejects({ title: 42 });
  rejects({ title: { toString: () => 'x' } });
  rejects({ subtitle: ['a'] });
});

test('absent fields are omitted entirely rather than written as undefined', () => {
  const result = pickProjectFields({ title: 'Only this' }, EDITABLE_INFO_FIELDS);
  assert.deepEqual(Object.keys(result), ['title']);
});

test('the body itself must be an object', () => {
  for (const body of [null, undefined, 'x', 42, ['title']]) {
    assert.throws(() => pickProjectFields(body, EDITABLE_INFO_FIELDS), {
      statusCode: 400,
    });
  }
});

test('the content route is narrower than the info route', () => {
  // Sending title to the content route is a client mistake worth surfacing.
  rejects({ title: 'x' }, EDITABLE_CONTENT_FIELDS);
  assert.ok(EDITABLE_CONTENT_FIELDS.every((f) => EDITABLE_INFO_FIELDS.includes(f)));
});
