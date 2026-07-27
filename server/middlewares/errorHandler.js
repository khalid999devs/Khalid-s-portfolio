'use strict';

const { StatusCodes } = require('http-status-codes');
const { MulterError } = require('multer');
const CustomAPIError = require('../errors/custom-api');
const cleanupUploads = require('./cleanupUploads');
const env = require('../config/env');

/**
 * Turns an error into a response without telling the caller more than it should
 * know.
 *
 * Previously this returned `err.message` for anything at all, so a Sequelize
 * failure sent its SQL and a stray library error sent its internals -- the
 * expired-JWT case answered `500 {"msg":"jwt expired"}`. It also
 * `console.log`ged the entire error object on every request, including ones
 * that were merely a 404.
 *
 * Now: errors this application raised deliberately keep their message, because
 * they were written for the caller. Everything else gets a generic message and
 * the detail goes to the server log.
 */

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'That file is too large.',
  LIMIT_FILE_COUNT: 'Too many files in one request.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected upload field.',
  LIMIT_PART_COUNT: 'Too many parts in one request.',
  LIMIT_FIELD_COUNT: 'Too many form fields.',
  LIMIT_FIELD_KEY: 'A form field name is too long.',
  LIMIT_FIELD_VALUE: 'A form field value is too long.',
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers
// by arity; dropping `next` turns this back into ordinary middleware.
const errorHandlerMiddleware = (err, req, res, next) => {
  // Multer has already written any uploaded files by the time a handler throws.
  // Without this they stay on disk with nothing referencing them.
  cleanupUploads(req);

  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong, please try again later';

  if (err instanceof CustomAPIError) {
    // Raised by this codebase, for the caller.
    message = err.message;
  } else if (err instanceof MulterError) {
    // Upload limits were previously reported as opaque 500s.
    statusCode = StatusCodes.BAD_REQUEST;
    message = MULTER_MESSAGES[err.code] || 'Upload rejected.';
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = err.errors.map((item) => item.message).join(', ');
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'That value is already in use.';
  } else if (err.type === 'entity.too.large') {
    statusCode = StatusCodes.REQUEST_TOO_LONG;
    message = 'Request body is too large.';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Request body is not valid JSON.';
  }

  // Log the real error server-side. 4xx are the caller's problem and are noise
  // at this level; 5xx are ours and are always recorded.
  if (statusCode >= 500) {
    console.error(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ->`,
      env.isProduction() ? `${err.name}: ${err.message}` : err
    );
  }

  // An error response is specific to this request and must never be cached.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(statusCode).json({ msg: message });
};

module.exports = errorHandlerMiddleware;
