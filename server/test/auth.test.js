'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sign } = require('jsonwebtoken');
const { readFileSync } = require('fs');
const { join } = require('path');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

const env = require('../config/env');
const adminValidate = require('../middlewares/adminTokenVerify');

const callWith = (token) => {
  const req = { signedCookies: token === undefined ? {} : { token } };
  let nextCalled = false;
  try {
    adminValidate(req, {}, () => {
      nextCalled = true;
    });
  } catch (error) {
    return { error, nextCalled, req };
  }
  return { error: null, nextCalled, req };
};

const tokenWith = (payload, options = {}) =>
  sign(payload, env.adminSecret, { algorithm: 'HS256', ...options });

test('no cookie is rejected', () => {
  const { error, nextCalled } = callWith(undefined);
  assert.equal(nextCalled, false);
  assert.equal(error.statusCode, 403);
});

/**
 * This returned HTTP 500 {"msg":"jwt expired"} before: `verify` threw, the
 * throw escaped, and the error handler had no statusCode to work with. An
 * expired session is an authentication outcome, not a server fault.
 */
test('an expired token is an auth failure, not a server error', () => {
  const expired = tokenWith({
    id: 1,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) - 3600,
  });
  const { error, nextCalled } = callWith(expired);
  assert.equal(nextCalled, false);
  assert.equal(error.statusCode, 403);
  // The library's own wording must not reach the client.
  assert.doesNotMatch(error.message, /jwt|expired/i);
});

test('a malformed token is rejected', () => {
  for (const bad of ['', 'not-a-token', 'a.b.c', '{}']) {
    const { error, nextCalled } = callWith(bad);
    assert.equal(nextCalled, false, `should reject ${JSON.stringify(bad)}`);
    assert.equal(error.statusCode, 403);
  }
});

test('a token signed with the wrong secret is rejected', () => {
  const foreign = sign({ id: 1, role: 'admin' }, 'a-different-secret-entirely', {
    algorithm: 'HS256',
    expiresIn: 3600,
  });
  const { error } = callWith(foreign);
  assert.equal(error.statusCode, 403);
});

/**
 * An `alg: none` token carries no signature at all. Pinning algorithms is what
 * stops the token choosing how it gets verified.
 */
test('an unsigned (alg: none) token is rejected', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ id: 1, role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');

  const { error } = callWith(`${header}.${body}.`);
  assert.equal(error.statusCode, 403);
});

test('a valid token without the admin role is rejected', () => {
  const token = tokenWith({ id: 1, userName: 'someone' }, { expiresIn: 3600 });
  const { error, nextCalled } = callWith(token);
  assert.equal(nextCalled, false);
  assert.equal(error.statusCode, 403);
});

test('a valid administrator token is accepted and attached to the request', () => {
  const token = tokenWith({ id: 7, userName: 'owner', role: 'admin' }, { expiresIn: 3600 });
  const { error, nextCalled, req } = callWith(token);
  assert.equal(error, null);
  assert.equal(nextCalled, true);
  assert.equal(req.admin.id, 7);
  assert.equal(req.admin.role, 'admin');
});

test('cookie lifetime matches the token lifetime', () => {
  // These disagreed by 23 hours, so the browser kept sending a credential the
  // server had already stopped accepting.
  assert.equal(env.sessionSeconds, env.sessionMinutes * 60);
  assert.ok(env.sessionMinutes >= 5 && env.sessionMinutes <= 1440);
});

test('the absent-account placeholder hash costs the same as a real one', () => {
  // Cost is exponential, so a cheaper placeholder answers measurably faster for
  // a username that does not exist. That was real: cost 10 here against cost 12
  // for real accounts produced 55ms versus 206ms, which is a username oracle
  // regardless of the responses being byte identical.
  const source = readFileSync(join(__dirname, '..', 'controllers', 'admin.js'), 'utf8');
  const match = /ABSENT_ACCOUNT_HASH =\s*'(\$2[aby]\$(\d{2})\$[^']+)'/.exec(source);

  assert.ok(match, 'ABSENT_ACCOUNT_HASH should be a bcrypt hash literal');

  const { bcryptCost } = require('../utils/adminCredentials');
  assert.equal(
    Number(match[2]),
    bcryptCost(),
    `placeholder hash cost ${match[2]} must equal the cost real passwords use (${bcryptCost()})`
  );
});
