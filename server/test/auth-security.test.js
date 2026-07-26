const assert = require('node:assert/strict');
const test = require('node:test');
const { verify } = require('jsonwebtoken');

const { parseAllowedOrigins, validateRuntimeConfig } = require('../index');
const { Admin } = require('../models');
const adminRouter = require('../routers/admin');
const adminTokenVerify = require('../middlewares/adminTokenVerify');
const {
  ADMIN_COOKIE_MAX_AGE_MS,
  ADMIN_COOKIE_NAME,
  attachTokenToResponse,
  clearTokenFromResponse,
  createAdminJWT,
  getAdminTokenVerificationOptions,
} = require('../utils/createToken');

const adminSecret = 'admin-secret-'.padEnd(40, 'a');
const cookieSecret = 'cookie-secret-'.padEnd(40, 'b');

test('runtime configuration requires distinct, strong application secrets', () => {
  assert.throws(
    () =>
      validateRuntimeConfig({
        ADMIN_SECRET: 'short',
        COOKIE_SECRET: cookieSecret,
        NODE_ENV: 'test',
      }),
    /ADMIN_SECRET must contain at least 32 characters/
  );

  assert.throws(
    () =>
      validateRuntimeConfig({
        ADMIN_SECRET: adminSecret,
        COOKIE_SECRET: adminSecret,
        NODE_ENV: 'test',
      }),
    /must be different/
  );
});

test('production only accepts HTTPS browser origins', () => {
  const productionEnv = {
    ADMIN_SECRET: adminSecret,
    ADMIN_USERNAME: 'portfolio-admin',
    COOKIE_SECRET: cookieSecret,
    DB_HOST: 'db.internal',
    DB_NAME: 'portfolio',
    DB_PASS: 'database-password',
    DB_SSL: 'true',
    DB_USER: 'portfolio-user',
    NODE_ENV: 'production',
    REMOTE_CLIENT_APP: 'http://portfolio.example.test',
  };

  assert.throws(
    () => validateRuntimeConfig(productionEnv),
    /must use HTTPS in production/
  );

  const config = validateRuntimeConfig({
    ...productionEnv,
    REMOTE_CLIENT_APP:
      'https://portfolio.example.test, https://portfolio.example.test',
  });
  assert.deepEqual(config.allowedOrigins, [
    'https://portfolio.example.test',
  ]);

  assert.throws(
    () =>
      validateRuntimeConfig({
        ...productionEnv,
        DB_SSL: 'false',
        REMOTE_CLIENT_APP: 'https://portfolio.example.test',
      }),
    /DB_SSL=true is required in production/
  );
});

test('allowed origins are normalized and malformed URLs reject', () => {
  assert.deepEqual(
    parseAllowedOrigins(
      'https://example.test/path, https://admin.example.test/'
    ),
    ['https://example.test', 'https://admin.example.test']
  );
  assert.throws(() => parseAllowedOrigins('not a URL'), /invalid URL/);
});

test('admin tokens require the fixed algorithm, issuer, audience, and subject', () => {
  const originalAdminSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = adminSecret;

  try {
    const token = createAdminJWT({
      id: 42,
      sessionVersion: 7,
      userName: 'admin',
    });
    const payload = verify(
      token,
      adminSecret,
      getAdminTokenVerificationOptions()
    );

    assert.equal(payload.id, 42);
    assert.equal(payload.sessionVersion, 7);
    assert.equal(payload.sub, '42');
    assert.equal(payload.role, 'admin');
    assert.equal(payload.iss, 'my-portfolio-api');
    assert.equal(payload.aud, 'my-portfolio-admin');
    assert.ok(payload.exp - payload.iat <= 60 * 60);
  } finally {
    if (originalAdminSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = originalAdminSecret;
  }
});

test('admin cookies are host-only, signed, HttpOnly, strict, and time-aligned', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const calls = [];
  const response = {
    cookie(...args) {
      calls.push({ method: 'cookie', args });
    },
    clearCookie(...args) {
      calls.push({ method: 'clearCookie', args });
    },
  };

  try {
    attachTokenToResponse({ res: response, token: 'signed-jwt' });
    clearTokenFromResponse(response);

    const setOptions = calls[0].args[2];
    assert.equal(calls[0].args[0], ADMIN_COOKIE_NAME);
    assert.equal(setOptions.httpOnly, true);
    assert.equal(setOptions.sameSite, 'strict');
    assert.equal(setOptions.secure, true);
    assert.equal(setOptions.signed, true);
    assert.equal(setOptions.path, '/');
    assert.equal(setOptions.maxAge, ADMIN_COOKIE_MAX_AGE_MS);
    assert.equal(Object.hasOwn(setOptions, 'domain'), false);

    const clearOptions = calls[1].args[1];
    assert.equal(calls[1].args[0], ADMIN_COOKIE_NAME);
    assert.equal(clearOptions.httpOnly, true);
    assert.equal(clearOptions.sameSite, 'strict');
    assert.equal(clearOptions.secure, true);
    assert.equal(clearOptions.path, '/');
    assert.equal(Object.hasOwn(clearOptions, 'maxAge'), false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test('credential rotation invalidates tokens with an older session version', async () => {
  const originalAdminSecret = process.env.ADMIN_SECRET;
  const originalFindByPk = Admin.findByPk;
  process.env.ADMIN_SECRET = adminSecret;
  Admin.findByPk = async () => ({
    id: 42,
    sessionVersion: 4,
    userName: 'admin',
  });

  const createRequest = (sessionVersion) => ({
    signedCookies: {
      token: createAdminJWT({ id: 42, sessionVersion, userName: 'admin' }),
    },
  });
  const response = { set() {} };

  try {
    await assert.rejects(
      () => adminTokenVerify(createRequest(3), response, () => {}),
      /Invalid or expired admin session/u
    );

    const request = createRequest(4);
    let nextCalled = false;
    await adminTokenVerify(request, response, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.deepEqual(request.admin, {
      id: 42,
      role: 'admin',
      userName: 'admin',
    });
  } finally {
    Admin.findByPk = originalFindByPk;
    if (originalAdminSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = originalAdminSecret;
  }
});

test('admin router has no registration endpoint and logout is POST-only', () => {
  const routes = adminRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      methods: Object.keys(layer.route.methods),
      path: layer.route.path,
    }));

  assert.equal(routes.some((route) => route.path === '/reg'), false);
  assert.deepEqual(
    routes.find((route) => route.path === '/logout'),
    { methods: ['post'], path: '/logout' }
  );
});
