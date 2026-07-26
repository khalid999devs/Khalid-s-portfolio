'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MulterError } = require('multer');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

const errorHandler = require('../middlewares/errorHandler');
const { BadRequestError, UnauthorizedError } = require('../errors');

const respond = (error) => {
  const headers = {};
  let status = null;
  let payload = null;

  const res = {
    setHeader: (key, value) => {
      headers[key.toLowerCase()] = value;
    },
    status(code) {
      status = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    },
  };

  errorHandler(error, { method: 'GET', originalUrl: '/api/test' }, res, () => {});
  return { status, payload, headers };
};

test('errors this codebase raises keep their message', () => {
  const { status, payload } = respond(new BadRequestError('Title is required.'));
  assert.equal(status, 400);
  assert.equal(payload.msg, 'Title is required.');

  const forbidden = respond(new UnauthorizedError('admin not logged in'));
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.payload.msg, 'admin not logged in');
});

/**
 * The old handler returned `err.message` for anything at all, so a database
 * failure sent its SQL and a library error sent its internals.
 */
test('unexpected errors do not leak their message', () => {
  const leaky = new Error(
    "SELECT * FROM admins WHERE userName = 'x' -- connection to 10.0.0.5 refused"
  );
  const { status, payload } = respond(leaky);

  assert.equal(status, 500);
  assert.equal(payload.msg, 'Something went wrong, please try again later');
  assert.doesNotMatch(payload.msg, /SELECT|admins|10\.0\.0\.5/);
});

test('a jsonwebtoken error does not reach the client verbatim', () => {
  const jwtError = new Error('jwt expired');
  jwtError.name = 'TokenExpiredError';
  const { status, payload } = respond(jwtError);

  assert.equal(status, 500);
  assert.doesNotMatch(payload.msg, /jwt/i);
});

test('upload limit errors are client errors, not server errors', () => {
  const tooBig = respond(new MulterError('LIMIT_FILE_SIZE'));
  assert.equal(tooBig.status, 400);
  assert.match(tooBig.payload.msg, /too large/i);

  const unexpected = respond(new MulterError('LIMIT_UNEXPECTED_FILE'));
  assert.equal(unexpected.status, 400);

  const unknown = respond(new MulterError('SOMETHING_NEW'));
  assert.equal(unknown.status, 400);
});

test('an oversized or unparseable body is a client error', () => {
  const tooLarge = Object.assign(new Error('request entity too large'), {
    type: 'entity.too.large',
  });
  assert.equal(respond(tooLarge).status, 413);

  const badJson = Object.assign(new Error('Unexpected token'), {
    type: 'entity.parse.failed',
  });
  assert.equal(respond(badJson).status, 400);
});

test('sequelize validation errors surface their field messages', () => {
  const validation = Object.assign(new Error('validation'), {
    name: 'SequelizeValidationError',
    errors: [{ message: 'title cannot be null' }],
  });
  const { status, payload } = respond(validation);
  assert.equal(status, 400);
  assert.match(payload.msg, /title cannot be null/);
});

test('error responses are never cached', () => {
  const { headers } = respond(new BadRequestError('nope'));
  assert.equal(headers['cache-control'], 'no-store');
});
