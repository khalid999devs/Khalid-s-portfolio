'use strict';

const { BadRequestError } = require('../errors');

const MAX_TECHNOLOGY_GROUPS = 50;
const MAX_ITEMS_PER_GROUP = 100;
const MAX_ITEM_LENGTH = 100;
const MAX_TECHNOLOGIES_BYTES = 60 * 1024;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const normalizeTechnologies = (value) => {
  let technologies = value;

  if (typeof technologies === 'string') {
    try {
      technologies = JSON.parse(technologies);
    } catch (_error) {
      throw new BadRequestError('Technologies must be a valid object');
    }
  }

  if (
    !technologies ||
    typeof technologies !== 'object' ||
    Array.isArray(technologies)
  ) {
    throw new BadRequestError('Technologies must be an object');
  }

  const entries = Object.entries(technologies);
  if (entries.length > MAX_TECHNOLOGY_GROUPS) {
    throw new BadRequestError(
      `Technologies must contain at most ${MAX_TECHNOLOGY_GROUPS} groups`
    );
  }

  const normalized = Object.create(null);
  const seenGroupNames = new Set();
  entries.forEach(([rawGroupName, rawItems]) => {
    const groupName = rawGroupName.normalize('NFC').trim();
    const groupComparisonKey = groupName.toLocaleLowerCase('en-US');
    if (
      !groupName ||
      [...groupName].length > 64 ||
      CONTROL_CHARACTERS.test(groupName) ||
      FORBIDDEN_OBJECT_KEYS.has(groupName) ||
      seenGroupNames.has(groupComparisonKey)
    ) {
      throw new BadRequestError('Technology group names are invalid');
    }
    seenGroupNames.add(groupComparisonKey);

    if (
      !Array.isArray(rawItems) ||
      rawItems.length > MAX_ITEMS_PER_GROUP
    ) {
      throw new BadRequestError(
        `Each technology group must contain at most ${MAX_ITEMS_PER_GROUP} items`
      );
    }

    const seen = new Set();
    normalized[groupName] = rawItems.map((rawItem) => {
      if (typeof rawItem !== 'string') {
        throw new BadRequestError('Technology names must be strings');
      }

      const item = rawItem.normalize('NFC').trim();
      if (
        !item ||
        [...item].length > MAX_ITEM_LENGTH ||
        CONTROL_CHARACTERS.test(item)
      ) {
        throw new BadRequestError(
          `Technology names must be between 1 and ${MAX_ITEM_LENGTH} characters`
        );
      }

      const comparisonKey = item.toLocaleLowerCase('en-US');
      if (seen.has(comparisonKey)) {
        throw new BadRequestError(
          `Duplicate technology in group: ${groupName}`
        );
      }
      seen.add(comparisonKey);
      return item;
    });
  });

  if (
    Buffer.byteLength(JSON.stringify(normalized), 'utf8') >
    MAX_TECHNOLOGIES_BYTES
  ) {
    throw new BadRequestError('Technologies exceed the storage limit');
  }

  return normalized;
};

const parseStoredTechnologies = (value) => {
  try {
    return normalizeTechnologies(value);
  } catch (_error) {
    throw new Error('Stored settings contain invalid technologies data');
  }
};

module.exports = {
  normalizeTechnologies,
  parseStoredTechnologies,
};
