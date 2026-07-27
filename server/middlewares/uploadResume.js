'use strict';

const multer = require('multer');
const { mkdirSync } = require('fs');
const { randomBytes } = require('crypto');
const { resolve, join } = require('path');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');
const { RESUME_FIELD } = require('../utils/mediaTypes');

/**
 * Storage for the single site-wide resume.
 *
 * Separate from `uploadFile` because project media is keyed by a numeric route
 * parameter and written to projects/<id>/, which the resume has no equivalent
 * of. Sharing that middleware would mean inventing a fake project id.
 *
 * The filename is random and the extension is assigned afterwards from the
 * file's actual signature (see `validateUploads`), exactly as for project
 * media. That matters as much here as anywhere: this file is served from the
 * static /uploads mount, so a document that is not really a PDF would be served
 * from the API origin under whatever name it arrived with.
 *
 * A random name also means a replacement never collides with a cached copy of
 * the previous resume -- the old hardcoded `Resume_Khalid_Ahammed.pdf` would
 * have been re-served from cache after an update.
 */

// A resume is a document, not media. 10 MB is generous for one and keeps the
// endpoint from being a general-purpose file drop.
const MAXIMUM_RESUME_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname !== RESUME_FIELD) {
      cb(new Error(`Unexpected upload field "${file.fieldname}".`));
      return;
    }

    const target = resolve(join(UPLOADS_ROOT, 'assets'));
    try {
      mkdirSync(target, { recursive: true });
    } catch (error) {
      cb(error);
      return;
    }

    cb(null, target);
  },

  filename: (req, file, cb) => {
    cb(null, `${RESUME_FIELD}_${randomBytes(16).toString('hex')}.upload`);
  },
});

const uploadResume = multer({
  storage,
  limits: {
    fileSize: MAXIMUM_RESUME_BYTES,
    files: 1,
    fields: 8,
    parts: 9,
    headerPairs: 32,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== RESUME_FIELD) {
      cb(new Error(`Unexpected upload field "${file.fieldname}".`));
      return;
    }
    cb(null, true);
  },
});

module.exports = uploadResume;
module.exports.MAXIMUM_RESUME_BYTES = MAXIMUM_RESUME_BYTES;
