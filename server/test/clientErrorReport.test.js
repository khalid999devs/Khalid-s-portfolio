'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('crypto');

const {
  KINDS,
  LIMITS,
  fingerprintOf,
  normaliseReport,
} = require('../utils/clientErrorReport');

// Everything a public endpoint stores passes through these. No database.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0';

const valid = (overrides = {}) => ({
  kind: 'error',
  message: 'TypeError: projects.map is not a function',
  stack: 'TypeError: projects.map is not a function\n    at Works (index-abc.js:1:2345)',
  source: 'https://example.com/assets/index-abc.js',
  line: 1,
  col: 2345,
  path: '/works',
  viewport: '1440x900',
  build: 'df578af',
  ...overrides,
});

test('a well-formed report becomes exactly the columns the table has', () => {
  const report = normaliseReport(valid(), UA);

  assert.deepEqual(Object.keys(report).sort(), [
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
  assert.equal(report.kind, 'error');
  assert.equal(report.message, 'TypeError: projects.map is not a function');
  assert.equal(report.line, 1);
  assert.equal(report.col, 2345);
  assert.equal(report.path, '/works');
  assert.equal(report.viewport, '1440x900');
  assert.equal(report.build, 'df578af');
  assert.equal(report.userAgent, UA);
});

test('every listed kind is accepted and nothing else is', () => {
  assert.deepEqual([...KINDS], ['error', 'unhandledrejection', 'react', 'chunk', 'boot']);

  for (const kind of KINDS) {
    assert.equal(normaliseReport(valid({ kind }), UA)?.kind, kind);
  }
  for (const kind of [undefined, null, '', 'Error', 'warning', 'error ', 42, ['error'], { kind: 'error' }]) {
    assert.equal(normaliseReport(valid({ kind }), UA), null, `kind ${JSON.stringify(kind)}`);
  }
});

test('a missing, empty or non-string message drops the report', () => {
  for (const message of [undefined, null, '', '   ', '\n\t', '\u0000\u0007', 42, {}, ['boom'], true]) {
    assert.equal(normaliseReport(valid({ message }), UA), null, `message ${JSON.stringify(message)}`);
  }
});

test('a body that is not an object drops the report', () => {
  for (const body of [undefined, null, '', 'error', 42, true, [], [valid()]]) {
    assert.equal(normaliseReport(body, UA), null);
  }
});

test('the user agent is the header, never a field of the body', () => {
  const report = normaliseReport(valid({ userAgent: 'forged', 'user-agent': 'forged' }), UA);
  assert.equal(report.userAgent, UA);

  // No header at all is stored as empty, not as whatever the body claimed.
  assert.equal(normaliseReport(valid({ userAgent: 'forged' }), undefined).userAgent, '');
});

test('nothing identifying a visitor is carried through', () => {
  const report = normaliseReport(
    valid({ ip: '203.0.113.9', cookie: 'token=abc', cookies: { token: 'abc' }, id: 7, count: 999 }),
    UA
  );

  for (const key of ['ip', 'cookie', 'cookies', 'id', 'count', 'firstSeenAt', 'lastSeenAt']) {
    assert.ok(!(key in report), `${key} must not be taken from the body`);
  }
});

test('every text field is cut to its column width', () => {
  const long = 'x'.repeat(10000);
  const report = normaliseReport(
    valid({ message: long, stack: long, source: long, path: long, viewport: long, build: long }),
    long
  );

  assert.equal(report.message.length, 500);
  assert.equal(report.stack.length, 4000);
  assert.equal(report.source.length, 300);
  assert.equal(report.path.length, 300);
  assert.equal(report.userAgent.length, 300);
  assert.equal(report.viewport.length, 20);
  assert.equal(report.build.length, 40);

  for (const [field, max] of Object.entries(LIMITS)) {
    assert.ok(report[field].length <= max, `${field} is over ${max}`);
  }
});

test('control characters are stripped from single-line fields', () => {
  const report = normaliseReport(
    valid({
      message: '\u001b[31mUnexpected token\r\nin JSON\u0000 at position 3\u0007',
      source: 'https://example.com/a.js\u0000',
      path: '/works\n/admin',
      viewport: '1440\tx900',
      build: 'abc\u009fdef',
    }),
    'Mozilla/5.0\r\nX-Injected: 1'
  );

  assert.equal(report.message, '[31mUnexpected token in JSON at position 3');
  assert.equal(report.source, 'https://example.com/a.js');
  assert.equal(report.path, '/works /admin');
  assert.equal(report.viewport, '1440 x900');
  assert.equal(report.build, 'abcdef');
  assert.equal(report.userAgent, 'Mozilla/5.0 X-Injected: 1');

  for (const field of ['message', 'source', 'path', 'viewport', 'build', 'userAgent']) {
    assert.doesNotMatch(report[field], /\p{Cc}/u, `${field} still has a control character`);
  }
});

test('a stack keeps its lines and tabs and loses other control characters', () => {
  const report = normaliseReport(
    valid({ stack: 'Error: boom\r\n\tat a (a.js:1:1)\u0000\r\tat b (b.js:2:2)\u001b[0m\n' }),
    UA
  );

  assert.equal(report.stack, 'Error: boom\n\tat a (a.js:1:1)\n\tat b (b.js:2:2)[0m');
});

test('a missing stack is stored empty, since the column is not nullable', () => {
  for (const stack of [undefined, null, 42, {}, ['at a']]) {
    assert.equal(normaliseReport(valid({ stack }), UA).stack, '');
  }
});

test('optional fields that are absent, empty or the wrong type become null', () => {
  for (const value of [undefined, null, '', '  ', 42, {}, [], true]) {
    const report = normaliseReport(valid({ source: value, viewport: value, build: value }), UA);
    assert.equal(report.source, null);
    assert.equal(report.viewport, null);
    assert.equal(report.build, null);
  }
});

test('a missing path is stored empty, since the column is not nullable', () => {
  for (const path of [undefined, null, 42, {}]) {
    assert.equal(normaliseReport(valid({ path }), UA).path, '');
  }
});

test('line and col must be non-negative integers that fit an INT column', () => {
  const accepted = [0, 1, 2345, 2147483647];
  for (const value of accepted) {
    const report = normaliseReport(valid({ line: value, col: value }), UA);
    assert.equal(report.line, value);
    assert.equal(report.col, value);
  }

  const rejected = [undefined, null, -1, 1.5, NaN, Infinity, 2147483648, '12', '', true, [1], {}];
  for (const value of rejected) {
    const report = normaliseReport(valid({ line: value, col: value }), UA);
    assert.equal(report.line, null, `line ${String(value)}`);
    assert.equal(report.col, null, `col ${String(value)}`);
  }
});

test('the fingerprint is sha256 of kind, message, source and line joined by newlines', () => {
  const report = normaliseReport(valid(), UA);
  const expected = createHash('sha256')
    .update(
      [
        'error',
        'TypeError: projects.map is not a function',
        'https://example.com/assets/index-abc.js',
        '1',
      ].join('\n')
    )
    .digest('hex');

  assert.equal(report.fingerprint, expected);
  assert.match(report.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(fingerprintOf(report), expected);
});

test('a null source or line hashes as an empty part', () => {
  const report = normaliseReport(valid({ source: undefined, line: undefined }), UA);
  const expected = createHash('sha256').update('error\nTypeError: projects.map is not a function\n\n').digest('hex');

  assert.equal(report.fingerprint, expected);
});

test('the same error from another page, browser or build is the same fingerprint', () => {
  const first = normaliseReport(valid(), UA);
  const again = normaliseReport(
    valid({ path: '/about', viewport: '390x844', build: 'aaaaaaa', col: 9, stack: 'different' }),
    'Mozilla/5.0 (iPhone)'
  );

  assert.equal(again.fingerprint, first.fingerprint);
});

test('a different kind, message, source or line is a different fingerprint', () => {
  const base = normaliseReport(valid(), UA).fingerprint;
  const changes = [
    { kind: 'react' },
    { message: 'TypeError: something else' },
    { source: 'https://example.com/assets/index-def.js' },
    { line: 2 },
    { source: undefined },
    { line: undefined },
  ];

  const seen = new Set([base]);
  for (const change of changes) {
    const { fingerprint } = normaliseReport(valid(change), UA);
    assert.ok(!seen.has(fingerprint), `${JSON.stringify(change)} should change the fingerprint`);
    seen.add(fingerprint);
  }
});

test('the fingerprint is taken after cleaning, so noise does not split one error', () => {
  const clean = normaliseReport(valid({ message: 'boom' }), UA);
  const noisy = normaliseReport(valid({ message: '  boom\u0000\n' }), UA);

  assert.equal(noisy.fingerprint, clean.fingerprint);
});

test('a newline cannot move text from one fingerprint part into the next', () => {
  // Uncleaned, both of these would hash "error\na\nb\nc\n1".
  const early = normaliseReport(valid({ message: 'a', source: 'b\nc' }), UA);
  const late = normaliseReport(valid({ message: 'a\nb', source: 'c' }), UA);

  assert.notEqual(early.fingerprint, late.fingerprint);
});
