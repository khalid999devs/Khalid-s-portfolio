const assert = require('node:assert/strict');
const test = require('node:test');

const { BadRequestError } = require('../errors');
const errorHandler = require('../middlewares/errorHandler');

const runHandler = (error) => {
  const response = {
    body: undefined,
    statusCode: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  errorHandler(
    error,
    { method: 'GET', originalUrl: '/test' },
    response,
    () => {}
  );

  return response;
};

test('unexpected server errors never leak their message', () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = runHandler(
      new Error('database password and internal host must stay private')
    );

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      succeed: false,
      msg: 'Something went wrong. Please try again later.',
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test('intentional client errors keep their safe message', () => {
  const response = runHandler(new BadRequestError('Invalid project input.'));

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    succeed: false,
    msg: 'Invalid project input.',
  });
});

test('JWT failures become a generic unauthorized response', () => {
  const error = new Error('jwt expired at an internal timestamp');
  error.name = 'TokenExpiredError';

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = runHandler(error);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.msg, 'Invalid or expired session.');
  } finally {
    console.error = originalConsoleError;
  }
});

test('Multer limit failures become a safe bad request', () => {
  const error = new Error('internal upload detail');
  error.name = 'MulterError';
  error.code = 'LIMIT_FILE_SIZE';

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = runHandler(error);
    assert.equal(response.statusCode, 400);
    assert.equal(
      response.body.msg,
      'An uploaded file exceeds the allowed size.'
    );
  } finally {
    console.error = originalConsoleError;
  }
});
