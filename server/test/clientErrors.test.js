'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

const store = require('../utils/clientErrorStore');
const router = require('../routers/clientErrors');
const adminValidate = require('../middlewares/adminTokenVerify');
const { clientErrorLimiter } = require('../middlewares/rateLimiters');
const {
  reportClientError,
  listClientErrors,
  clearClientErrors,
} = require('../controllers/clientErrors');

// The handlers with the store replaced, so nothing is written anywhere.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0';

const report = (overrides = {}) => ({
  kind: 'error',
  message: 'TypeError: x is undefined',
  stack: 'TypeError: x is undefined\n    at a.js:1:1',
  source: 'https://example.com/a.js',
  line: 1,
  col: 1,
  path: '/works',
  viewport: '1440x900',
  build: 'df578af',
  ...overrides,
});

const post = (body, headers = { 'user-agent': UA }) => {
  const res = {
    statusCode: null,
    ended: false,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    end(body) {
      this.ended = true;
      this.body = body;
      return this;
    },
  };
  reportClientError({ body, get: (name) => headers[name.toLowerCase()] }, res);
  return res;
};

const assertAccepted = (res) => {
  assert.equal(res.statusCode, 202);
  assert.equal(res.ended, true);
  assert.equal(res.body, undefined);
};

test('every report is answered 202 with no body, stored or not', (t) => {
  const record = t.mock.method(store, 'record', async () => {});

  const bodies = [
    report(),
    report({ kind: 'nonsense' }),
    report({ message: '' }),
    {},
    undefined,
    null,
    'a string',
    [report()],
  ];
  for (const body of bodies) assertAccepted(post(body));

  // Only the first was worth keeping.
  assert.equal(record.mock.callCount(), 1);
});

test('what reaches the store is the normalised report, keyed by a fingerprint', (t) => {
  const record = t.mock.method(store, 'record', async () => {});

  post(report({ message: '  spaced\nout  ', extra: 'dropped', ip: '203.0.113.9' }));

  const [stored] = record.mock.calls[0].arguments;
  assert.match(stored.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(stored.message, 'spaced out');
  assert.deepEqual(Object.keys(stored).sort(), [
    'build',
    'col',
    'fingerprint',
    'kind',
    'line',
    'message',
    'path',
    'source',
    'stack',
    'userAgent',
    'viewport',
  ]);
});

test('the stored user agent is the request header, not the body', (t) => {
  const record = t.mock.method(store, 'record', async () => {});

  post(report({ userAgent: 'forged' }));
  post(report({ userAgent: 'forged' }), {});

  const [first, second] = record.mock.calls.map((call) => call.arguments[0]);
  assert.equal(first.userAgent, UA);
  assert.equal(second.userAgent, '');
});

test('a store failure never reaches the visitor', (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  t.mock.method(store, 'record', () => {
    throw new Error('disk full');
  });

  assertAccepted(post(report()));

  assert.equal(logged.mock.callCount(), 1);
  assert.deepEqual(logged.mock.calls[0].arguments, ['Could not store client error:', 'disk full']);
});

const json = (handler) => {
  let payload;
  handler({}, { json: (body) => (payload = JSON.parse(JSON.stringify(body))) });
  return payload;
};

test('the admin list is the newest 100', (t) => {
  const entries = [{ fingerprint: 'b', message: 'b', count: 3 }, { fingerprint: 'a', message: 'a', count: 1 }];
  const list = t.mock.method(store, 'list', () => entries);

  assert.deepEqual(json(listClientErrors), {
    succeed: true,
    result: entries,
    msg: 'Successfully fetched client errors!',
  });
  assert.deepEqual(list.mock.calls[0].arguments, [100]);
});

test('clearing reports how many were removed, in the right number', (t) => {
  let removed = 12;
  t.mock.method(store, 'clear', () => removed);

  assert.deepEqual(json(clearClientErrors), {
    succeed: true,
    msg: 'Removed 12 client errors.',
    removed: 12,
  });

  removed = 1;
  assert.equal(json(clearClientErrors).msg, 'Removed 1 client error.');
});

test('reporting is public and rate limited; reading and clearing need an admin', () => {
  const handlers = Object.fromEntries(
    router.stack.map(({ route }) => [
      `${Object.keys(route.methods)[0]} ${route.path}`,
      route.stack.map((layer) => layer.handle),
    ])
  );

  assert.deepEqual(Object.keys(handlers).sort(), ['delete /', 'get /', 'post /']);
  assert.deepEqual(handlers['post /'], [clientErrorLimiter, reportClientError]);
  assert.deepEqual(handlers['get /'], [adminValidate, listClientErrors]);
  assert.deepEqual(handlers['delete /'], [adminValidate, clearClientErrors]);
});
