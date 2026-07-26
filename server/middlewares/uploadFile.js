'use strict';

const multer = require('multer');
const { mkdirSync } = require('fs');
const { randomBytes } = require('crypto');
const { resolve, join } = require('path');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');
const { UPLOAD_FIELDS } = require('../utils/mediaTypes');

/**
 * Writes uploads to a location derived entirely from server-side values.
 *
 * The previous version built both the directory and the filename from
 * `req.body.title`, a client-supplied string. `sanitizeFilename` stripped
 * `/ \ : * ? " < > |` but not `..`, so a project titled `..` escaped a
 * directory level. The extension was taken from `file.mimetype` for images and
 * from `file.originalname` for videos -- both client-controlled -- so a request
 * claiming `video/mp4` while naming its file `payload.html` wrote
 * attacker-controlled HTML into a statically served directory.
 *
 * Now: the directory comes from the numeric project id in the route, and the
 * filename is random. Neither can be influenced by the request body. The final
 * extension is assigned after upload, from the file's actual signature -- see
 * `middlewares/validateUploads.js`.
 *
 * Existing rows keep their old title-based paths. Nothing rewrites them; the
 * resolver only requires that a stored path stays inside the uploads root.
 */

const MAXIMUM_FILE_BYTES = 50 * 1024 * 1024;
const MAXIMUM_FILES_PER_REQUEST = 12;

/**
 * The project id comes from the route parameter, never the body. Anything that
 * is not a positive integer is refused rather than coerced, so no request can
 * steer the write path.
 */
const projectDirectoryFor = (req) => {
  const id = Number(req.params?.id);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return join(UPLOADS_ROOT, 'projects', String(id));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!UPLOAD_FIELDS.includes(file.fieldname)) {
      cb(new Error(`Unexpected upload field "${file.fieldname}".`));
      return;
    }

    const projectDirectory = projectDirectoryFor(req);
    if (!projectDirectory) {
      cb(new Error('A valid numeric project id is required to upload media.'));
      return;
    }

    const target = resolve(projectDirectory, file.fieldname);
    try {
      mkdirSync(target, { recursive: true });
    } catch (error) {
      cb(error);
      return;
    }

    cb(null, target);
  },

  filename: (req, file, cb) => {
    // No real extension yet. It is appended once the bytes have been inspected,
    // so an unrecognised upload never lands with a renderable suffix.
    cb(null, `${file.fieldname}_${randomBytes(16).toString('hex')}.upload`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAXIMUM_FILE_BYTES,
    files: MAXIMUM_FILES_PER_REQUEST,
    fields: 32,
    parts: MAXIMUM_FILES_PER_REQUEST + 32,
    headerPairs: 64,
  },
  fileFilter: (req, file, cb) => {
    // A cheap first pass only. The authoritative check reads the written bytes;
    // this exists so an obviously wrong upload is refused before it is stored.
    if (!UPLOAD_FIELDS.includes(file.fieldname)) {
      cb(new Error(`Unexpected upload field "${file.fieldname}".`));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
module.exports.MAXIMUM_FILE_BYTES = MAXIMUM_FILE_BYTES;
module.exports.MAXIMUM_FILES_PER_REQUEST = MAXIMUM_FILES_PER_REQUEST;
