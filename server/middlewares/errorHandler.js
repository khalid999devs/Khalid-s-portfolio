const { StatusCodes } = require('http-status-codes');

const GENERIC_SERVER_ERROR = 'Something went wrong. Please try again later.';

const errorHandlerMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const isServerError = !err.statusCode || err.statusCode >= 500;

  if (isServerError) {
    // Keep diagnostic details server-side. Never include request bodies here because
    // they may contain passwords, contact details, or provider credentials.
    console.error(`${req.method} ${req.originalUrl}`, err);
  }

  let customError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.statusCode ? err.message : GENERIC_SERVER_ERROR,
  };

  if (
    err.name === 'ValidationError' ||
    err.name === 'SequelizeValidationError'
  ) {
    const validationMessages = err.errors
      ? Object.values(err.errors)
          .map((item) => item.message)
          .filter(Boolean)
      : [];
    customError.msg = validationMessages.length
      ? validationMessages.join(',')
      : 'The request contains invalid data.';
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  if (err.code === 11000 || err.name === 'SequelizeUniqueConstraintError') {
    customError.msg = 'A record with that value already exists.';
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  if (err.name === 'CastError') {
    customError.msg = 'The requested item was not found.';
    customError.statusCode = StatusCodes.NOT_FOUND;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    customError.msg = 'Invalid or expired session.';
    customError.statusCode = StatusCodes.UNAUTHORIZED;
  }

  if (err.name === 'MulterError') {
    customError.msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'An uploaded file exceeds the allowed size.'
        : 'The upload does not meet the allowed limits.';
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  if (customError.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
    customError.msg = GENERIC_SERVER_ERROR;
  }

  return res.status(customError.statusCode).json({
    succeed: false,
    msg: customError.msg,
  });
};

module.exports = errorHandlerMiddleware;
