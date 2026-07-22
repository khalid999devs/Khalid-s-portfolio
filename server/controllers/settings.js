const { settings } = require('../models');
const { BadRequestError } = require('../errors');
const path = require('path');

const MAX_TECHNOLOGY_GROUPS = 50;
const MAX_ITEMS_PER_GROUP = 100;
const MAX_ITEM_LENGTH = 100;
const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const assertOnlyTechnologies = (body) => {
  const unexpectedField = Object.keys(body || {}).find(
    (field) => field !== 'technologies'
  );

  if (unexpectedField) {
    throw new BadRequestError(`Unexpected field: ${unexpectedField}`);
  }
};

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
    const groupName = rawGroupName.trim();
    const groupComparisonKey = groupName.toLocaleLowerCase('en-US');
    if (
      !groupName ||
      groupName.length > 64 ||
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

      const item = rawItem.trim();
      if (!item || item.length > MAX_ITEM_LENGTH) {
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

  return normalized;
};

const parseStoredTechnologies = (value) => {
  try {
    return normalizeTechnologies(value);
  } catch (_error) {
    throw new Error('Stored settings contain invalid technologies data');
  }
};

const addSettings = async (req, res) => {
  const body = req.body || {};
  assertOnlyTechnologies(body);
  const technologies = normalizeTechnologies(body.technologies);

  const existingSettings = await settings.findOne({ attributes: ['id'] });
  if (existingSettings) {
    throw new BadRequestError('Settings already exist');
  }

  const result = await settings.create({
    technologies: JSON.stringify(technologies),
  });
  const responseSettings = result.get
    ? result.get({ plain: true })
    : { ...result };
  responseSettings.technologies = technologies;

  res.json({
    succeed: true,
    msg: 'Successfully added settings',
    settings: responseSettings,
  });
};

const editSettings = async (req, res) => {
  const body = req.body || {};
  assertOnlyTechnologies(body);
  const technologies = normalizeTechnologies(body.technologies);
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    throw new BadRequestError('A valid settings id is required');
  }

  const currentSettings = await settings.findByPk(id);
  if (!currentSettings) {
    throw new BadRequestError('The requested settings do not exist');
  }

  await currentSettings.update({
    technologies: JSON.stringify(technologies),
  });

  res.json({
    succeed: true,
    msg: 'Successfully updated settings',
  });
};

const getSettings = async (req, res) => {
  const result = await settings.findOne({ order: [['id', 'ASC']] });
  let settingsRes;

  if (result) {
    settingsRes = result.get ? result.get({ plain: true }) : { ...result };
    settingsRes.technologies = parseStoredTechnologies(
      settingsRes.technologies
    );
  }

  res.json({
    succeed: true,
    result: settingsRes,
    msg: 'Successfully fetched settings!',
  });
};

const downloadResume = (req, res, next) => {
  const filePath = path.join(
    __dirname,
    '../uploads/assets/Resume_Khalid_Ahammed.pdf'
  );
  res.download(filePath, 'Resume_Khalid_Ahammed.pdf', (err) => {
    if (err) {
      next(new BadRequestError('Failed to download resume'));
    }
  });
};

module.exports = {
  addSettings,
  downloadResume,
  editSettings,
  getSettings,
  normalizeTechnologies,
};
