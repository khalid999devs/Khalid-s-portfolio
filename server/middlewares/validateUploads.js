'use strict';

const { renameSync, unlinkSync } = require('fs');
const { relative, sep } = require('path');
const { BadRequestError } = require('../errors');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');
const { detectFileType, isTypeAllowedForField } = require('../utils/mediaTypes');

/**
 * Decides what each uploaded file actually is, and rejects anything else.
 *
 * Runs after multer has written the files. Multer's `fileFilter` cannot do this
 * -- it is called before any bytes are read, so it can only see what the client
 * claims. Reading the written header is the only way to know.
 *
 * Files arrive named `<field>_<random>.upload`. A file whose signature is
 * recognised and permitted for its field is renamed to carry the extension of
 * its *detected* type. Everything else is deleted.
 *
 * `file.path` is rewritten in place so downstream controllers store the final
 * name; they already read `item.path`, so nothing else changes.
 */

/** Rewrites an absolute path to the URL-style relative form stored in the DB. */
const toStoredPath = (absolutePath) => {
  const relativePath = relative(UPLOADS_ROOT, absolutePath);
  return `uploads/${relativePath.split(sep).join('/')}`;
};

const discard = (absolutePath) => {
  try {
    unlinkSync(absolutePath);
  } catch {
    // Already gone, or never written. Nothing useful to do here.
  }
};

const collectFiles = (req) => {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files).flat();
  }
  return req.file ? [req.file] : [];
};

const validateUploads = (req, res, next) => {
  const files = collectFiles(req);
  if (files.length === 0) {
    next();
    return;
  }

  const accepted = [];

  try {
    for (const file of files) {
      const detected = detectFileType(file.path);

      if (!isTypeAllowedForField(file.fieldname, detected)) {
        throw new BadRequestError(
          detected
            ? `${detected.type} is not accepted for "${file.fieldname}".`
            : `Could not identify "${file.originalname}" as a supported media file.`
        );
      }

      const finalPath = file.path.replace(/\.upload$/, `.${detected.extension}`);
      renameSync(file.path, finalPath);

      file.path = toStoredPath(finalPath);
      file.detectedType = detected.type;
      // The claimed type is replaced rather than kept alongside, so nothing
      // downstream can accidentally trust it. The controllers embed this whole
      // object into the stored JSON.
      file.mimetype = detected.type;

      // The controllers serialize this object into a TEXT column that the
      // public `mode: 'single'` read returns verbatim, so anything left on it
      // is published. `destination` is an absolute filesystem path -- it would
      // hand every visitor the server's directory layout.
      delete file.destination;
      delete file.filename;

      // Needed for cleanup on the error path, but must never be serialized.
      Object.defineProperty(file, 'absolutePath', {
        value: finalPath,
        enumerable: false,
        configurable: true,
      });

      accepted.push(finalPath);
    }
  } catch (error) {
    // One bad file rejects the request, so a partially written set is never
    // recorded. Remove everything this request produced, accepted or not.
    for (const path of accepted) discard(path);
    for (const file of files) discard(file.path);
    next(error);
    return;
  }

  next();
};

module.exports = validateUploads;
module.exports.toStoredPath = toStoredPath;
