'use strict';

const { BadRequestError } = require('../errors');

/**
 * Explicit write allowlists for the project routes.
 *
 * Both mutation handlers used to do `projects.update({ ...req.body })`, so an
 * authenticated caller could write *any* column: `id`, `value`, `displayOrder`,
 * `createdAt`, and -- most damagingly -- the media path columns, which the
 * delete paths later hand to the filesystem.
 *
 * The lists below are exactly the fields the admin panel sends. Everything else
 * is rejected rather than silently dropped, so a genuine client bug surfaces
 * instead of appearing to succeed.
 */

// Sent by ProjectTitles (title/subtitle/overview/role/category/date/
// locationYear) and LinksAndTechs (siteLink/designLink/codeLink/techStack).
const EDITABLE_INFO_FIELDS = Object.freeze([
  'title',
  'subtitle',
  'overview',
  'role',
  'category',
  'date',
  'locationYear',
  'siteLink',
  'designLink',
  'codeLink',
  'techStack',
]);

// The content route additionally receives uploaded files, whose paths are
// derived server-side and never taken from the body.
const EDITABLE_CONTENT_FIELDS = Object.freeze([
  'siteLink',
  'designLink',
  'codeLink',
  'techStack',
]);

/**
 * Never writable over HTTP, for the record and for the tests:
 *   id, value       -- `value` is the public URL slug; recomputing it on a title
 *                      change would break every existing link to the project.
 *   displayOrder    -- owned by the dedicated reorder route.
 *   bannerImg, videos, thumbnailContents, sliderContents
 *                   -- media columns, written only from actual uploads.
 *   createdAt, updatedAt
 */

const JSON_ARRAY_FIELDS = Object.freeze(['role', 'techStack']);

const asStringArray = (value, field) => {
  const array = typeof value === 'string' ? safeParse(value, field) : value;

  if (!Array.isArray(array)) {
    throw new BadRequestError(`"${field}" must be an array.`);
  }

  return array.map((entry) => {
    if (typeof entry !== 'string') {
      throw new BadRequestError(`"${field}" must contain only strings.`);
    }
    const trimmed = entry.trim();
    // Empty entries are what left two production rows with role `[""]`, which
    // is invalid against this route's own rules.
    if (trimmed === '') {
      throw new BadRequestError(`"${field}" must not contain empty values.`);
    }
    return trimmed;
  });
};

const safeParse = (value, field) => {
  try {
    return JSON.parse(value);
  } catch {
    throw new BadRequestError(`"${field}" is not valid JSON.`);
  }
};

/**
 * Picks the allowed fields from a request body and normalizes them for storage.
 * Array fields come back JSON-encoded, matching the TEXT columns.
 */
const pickProjectFields = (body, allowed) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('Request body must be an object.');
  }

  const rejected = Object.keys(body).filter((key) => !allowed.includes(key));
  if (rejected.length > 0) {
    throw new BadRequestError(
      `These fields cannot be set on this route: ${rejected.join(', ')}.`
    );
  }

  const result = {};
  for (const field of allowed) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;

    const value = body[field];

    if (JSON_ARRAY_FIELDS.includes(field)) {
      result[field] = JSON.stringify(asStringArray(value, field));
      continue;
    }

    // The remaining fields are plain strings. null clears an optional link.
    if (value === null || value === undefined) {
      result[field] = null;
      continue;
    }
    if (typeof value !== 'string') {
      throw new BadRequestError(`"${field}" must be a string.`);
    }
    result[field] = value;
  }

  return result;
};

module.exports = {
  EDITABLE_INFO_FIELDS,
  EDITABLE_CONTENT_FIELDS,
  JSON_ARRAY_FIELDS,
  pickProjectFields,
};
