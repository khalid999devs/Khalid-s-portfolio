const { settings } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { existsSync, unlinkSync } = require('fs');
const { resolveStoredUploadPath } = require('../utils/uploadPaths');

const addSettings = async (req, res) => {
  let data = req.body;
  if (!data.technologies)
    throw new BadRequestError('Please add technologies data of yours');

  data.technologies = JSON.stringify(data.technologies);
  let result = await settings.create(data);

  result.dataValues.technologies = JSON.parse(result.dataValues.technologies);

  res.json({
    succeed: true,
    msg: 'Successfully added settings',
    settings: result,
  });
};

const editSettings = async (req, res) => {
  const id = req.params.id;

  // Only `technologies` is editable here. This used to spread the whole body
  // into the update, which now includes the resume columns -- a settings edit
  // could point `resume` at any stored path, or blank it, without going through
  // the upload route that verifies the file is a PDF and cleans up the old one.
  const data = { technologies: JSON.stringify(req.body.technologies) };

  await settings.update(data, { where: { id } });

  res.json({
    succeed: true,
    msg: 'Successfully updated settings',
  });
};

const getSettings = async (req, res) => {
  let result = await settings.findAll();
  let settingsRes = undefined;

  if (result[0]) {
    settingsRes = result[0];
    settingsRes.dataValues.technologies = JSON.parse(
      settingsRes.dataValues.technologies
    );
  }

  res.json({
    succeed: true,
    result: settingsRes,
    msg: 'Successfully fetched settings!',
  });
};

/** The single settings row, or null. The table holds at most one. */
const currentSettings = async () => (await settings.findAll({ limit: 1 }))[0] || null;

/**
 * Replaces the stored resume.
 *
 * The file has already been written by multer and verified to be a real PDF by
 * `validateUploads`, which also renamed it to carry a .pdf extension and
 * rewrote `file.path` to the stored URL-style form.
 */
const uploadResumeFile = async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new BadRequestError('No resume file was received.');
  }

  const row = await currentSettings();
  if (!row) {
    // Deleting the just-written file keeps a failed request from leaving an
    // orphan under /uploads that nothing references.
    if (file.absolutePath && existsSync(file.absolutePath)) {
      try {
        unlinkSync(file.absolutePath);
      } catch {
        // Nothing useful to do; the request is failing regardless.
      }
    }
    throw new BadRequestError(
      'Site settings do not exist yet. Create them before uploading a resume.'
    );
  }

  const previous = row.resume;

  await row.update({
    resume: file.path,
    // Trimmed and length-capped: this is the only client-supplied value stored
    // here, and it is echoed back as a Content-Disposition filename.
    resumeOriginalName:
      typeof file.originalname === 'string' && file.originalname.trim()
        ? file.originalname.trim().slice(0, 255)
        : 'resume.pdf',
  });

  // Remove the file this one replaced. Done after the row is updated, so a
  // failure to write the database never deletes the resume that is still live.
  if (previous && previous !== file.path) {
    const previousPath = resolveStoredUploadPath(previous);
    if (previousPath && existsSync(previousPath)) {
      try {
        unlinkSync(previousPath);
      } catch {
        // An orphaned old file is untidy, not harmful. The new one is stored.
      }
    }
  }

  res.json({
    succeed: true,
    msg: 'Successfully updated the resume',
    resume: row.resume,
    resumeOriginalName: row.resumeOriginalName,
  });
};

const deleteResume = async (req, res) => {
  const row = await currentSettings();
  if (!row || !row.resume) {
    throw new NotFoundError('There is no resume to remove.');
  }

  const stored = row.resume;
  await row.update({ resume: null, resumeOriginalName: null });

  const absolutePath = resolveStoredUploadPath(stored);
  if (absolutePath && existsSync(absolutePath)) {
    try {
      unlinkSync(absolutePath);
    } catch {
      // Row is already cleared; a leftover file is not worth failing over.
    }
  }

  res.json({ succeed: true, msg: 'Successfully removed the resume' });
};

const downloadResume = async (req, res, next) => {
  const row = await currentSettings();

  if (!row || !row.resume) {
    throw new NotFoundError('No resume has been uploaded yet.');
  }

  // Resolved through the shared helper rather than joined by hand. The old code
  // did `path.join(__dirname, '../uploads/assets/<hardcoded name>')`, which
  // ignores UPLOADS_DIR entirely -- so with the uploads root on a mounted
  // volume the static mount and this endpoint pointed at different directories
  // and the download failed in exactly the deployment the docs prescribe.
  const filePath = resolveStoredUploadPath(row.resume);

  if (!filePath || !existsSync(filePath)) {
    throw new NotFoundError('The stored resume file is missing.');
  }

  res.download(filePath, row.resumeOriginalName || 'resume.pdf', (err) => {
    if (!err) return;

    // This callback runs asynchronously, outside the request chain whose
    // rejections Express forwards. Throwing here does not produce a 400 —
    // it escapes Express entirely and terminates the process, so a single
    // unauthenticated GET took the whole API down whenever this file was
    // missing. Hand the error to Express instead.
    if (res.headersSent) {
      // The response already started streaming, so no status can be sent.
      // Abort the connection rather than leaving the client hanging.
      res.destroy(err);
      return;
    }

    next(new BadRequestError('Failed to download resume'));
  });
};

module.exports = {
  addSettings,
  editSettings,
  getSettings,
  downloadResume,
  uploadResumeFile,
  deleteResume,
};
