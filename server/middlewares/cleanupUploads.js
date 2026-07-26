'use strict';

const { unlinkSync } = require('fs');
const { resolveStoredUploadPath } = require('../utils/uploadPaths');

/**
 * Removes files a failed request had already written.
 *
 * Multer writes to disk before any controller runs, so a request rejected
 * afterwards -- a bad `mode`, a missing project, a validation error, a database
 * failure -- left its uploads behind with nothing in the database referencing
 * them. They accumulated silently and only a manual sweep would ever find them.
 *
 * A successful request never reaches the error handler, so deleting everything
 * this request uploaded is safe here.
 */
const collectFiles = (req) => {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files).flat();
  }
  return req.file ? [req.file] : [];
};

const cleanupUploads = (req) => {
  for (const file of collectFiles(req)) {
    // `absolutePath` is set once the file has been identified and renamed;
    // before that, `file.path` is still the absolute temporary name.
    const target = file.absolutePath || resolveStoredUploadPath(file.path) || file.path;
    try {
      unlinkSync(target);
    } catch {
      // Already removed, or never written. Either way there is nothing to do.
    }
  }
};

module.exports = cleanupUploads;
