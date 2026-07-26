const { settings } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const fs = require('node:fs');
const path = require('path');
const {
  normalizeTechnologies,
  parseStoredTechnologies,
} = require('../utils/technologySettings');

const DEFAULT_RESUME_PATH = path.resolve(
  __dirname,
  '../uploads/assets/Resume_Khalid_Ahammed.pdf'
);
const MAX_RESUME_BYTES = 20 * 1024 * 1024;
const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

const resolveResumeFilePath = (environment = process.env) =>
  environment.RESUME_FILE_PATH?.trim() || DEFAULT_RESUME_PATH;

const isResumeAvailable = async (environment = process.env) => {
  const filePath = resolveResumeFilePath(environment);
  if (path.extname(filePath).toLowerCase() !== '.pdf') return false;

  let file;
  try {
    file = await fs.promises.open(filePath, fs.constants.O_RDONLY);
    const stats = await file.stat();
    if (
      !stats.isFile() ||
      stats.size < PDF_SIGNATURE.length ||
      stats.size > MAX_RESUME_BYTES
    ) {
      return false;
    }

    const signature = Buffer.alloc(PDF_SIGNATURE.length);
    const { bytesRead } = await file.read(
      signature,
      0,
      signature.length,
      0
    );
    return (
      bytesRead === PDF_SIGNATURE.length &&
      signature.equals(PDF_SIGNATURE)
    );
  } catch (_error) {
    return false;
  } finally {
    await file?.close().catch(() => {});
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

  res.set('Cache-Control', 'public, no-cache, must-revalidate');
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

  res.set('Cache-Control', 'no-store');
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
