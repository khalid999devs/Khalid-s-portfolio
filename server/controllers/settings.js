const { settings } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const fs = require('node:fs');
const path = require('path');

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
const DEFAULT_RESUME_PATH = path.resolve(
  __dirname,
  '../uploads/assets/Resume_Khalid_Ahammed.pdf'
);

const resolveResumeFilePath = (environment = process.env) =>
  environment.RESUME_FILE_PATH?.trim() || DEFAULT_RESUME_PATH;

const isResumeAvailable = async (environment = process.env) => {
  try {
    await fs.promises.access(
      resolveResumeFilePath(environment),
      fs.constants.R_OK
    );
    return true;
  } catch (_error) {
    return false;
  }
};

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

  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_TECHNOLOGIES_BYTES) {
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

const addSettings = async (req, res) => {
  const body = req.body || {};
  assertOnlyTechnologies(body);
  const technologies = normalizeTechnologies(body.technologies);

  const existingSettings = await settings.findOne({ attributes: ['id'] });
  if (existingSettings) {
    throw new BadRequestError('Settings already exist');
  }

  const result = await settings.create({
    // A fixed primary key turns concurrent cross-instance creates into one
    // winner plus a database-enforced conflict instead of duplicate settings.
    id: 1,
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
  const resumeAvailable = await isResumeAvailable();
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
    resumeAvailable,
    msg: 'Successfully fetched settings!',
  });
};

const downloadResume = async (req, res, next) => {
  const filePath = resolveResumeFilePath();
  if (!(await isResumeAvailable())) {
    next(new NotFoundError('Resume is not available.'));
    return;
  }

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
  isResumeAvailable,
  normalizeTechnologies,
  resolveResumeFilePath,
};
