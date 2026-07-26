const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { DataTypes, Utils } = require('sequelize');

const {
  configureHttpServer,
  createApp,
  createRateLimiters,
  createUnsafeRequestOriginGuard,
  parseAllowedOrigins,
  validateRuntimeConfig,
} = require('../index');

const adminSecret = 'admin-secret-'.padEnd(40, 'a');
const cookieSecret = 'cookie-secret-'.padEnd(40, 'b');

const createEnvironment = (overrides = {}) => ({
  ADMIN_SECRET: adminSecret,
  ADMIN_USERNAME: 'portfolio-admin',
  COOKIE_SECRET: cookieSecret,
  DB_SSL: 'true',
  NODE_ENV: 'test',
  REMOTE_CLIENT_APP: 'http://portfolio.example.test',
  ...overrides,
});

const listen = async (app) => {
  const { port, server } = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', (error) => {
      if (error) {
        reject(error);
        return;
      }

      const address = instance.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Test server did not expose a TCP address'));
        return;
      }

      resolve({ port: address.port, server: instance });
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }

        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};

test('patched UUID override preserves the Sequelize v6 CommonJS contract', () => {
  assert.match(
    Utils.toDefaultValue(DataTypes.UUIDV4()),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
});

test('proxy and rate-limit settings accept only bounded decimal integers', () => {
  assert.throws(
    () => validateRuntimeConfig(createEnvironment({ TRUST_PROXY_HOPS: 'true' })),
    /TRUST_PROXY_HOPS must be an integer between 0 and 10/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ API_RATE_LIMIT_WINDOW_MS: '999' })
      ),
    /API_RATE_LIMIT_WINDOW_MS must be an integer between 1000 and 86400000/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ ADMIN_LOGIN_RATE_LIMIT_MAX_REQUESTS: '0' })
      ),
    /ADMIN_LOGIN_RATE_LIMIT_MAX_REQUESTS must be an integer between 1 and 10000/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ SHUTDOWN_TIMEOUT_MS: '999' })
      ),
    /SHUTDOWN_TIMEOUT_MS must be an integer between 1000 and 60000/
  );

  const config = validateRuntimeConfig(
    createEnvironment({
      API_RATE_LIMIT_MAX_REQUESTS: '25',
      READINESS_RATE_LIMIT_WINDOW_MS: '60000',
      TRUST_PROXY_HOPS: '2',
    })
  );

  assert.equal(config.trustProxyHops, 2);
  assert.equal(config.rateLimits.api.limit, 25);
  assert.equal(config.rateLimits.readiness.windowMs, 60_000);
  assert.equal(config.shutdownTimeoutMs, 10_000);
});

test('configured resume paths must be absolute PDF paths', () => {
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ RESUME_FILE_PATH: 'resume.pdf' })
      ),
    /RESUME_FILE_PATH must be an absolute path/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ RESUME_FILE_PATH: '/private/resume.txt' })
      ),
    /RESUME_FILE_PATH must identify a PDF file/
  );
  assert.doesNotThrow(() =>
    validateRuntimeConfig(
      createEnvironment({ RESUME_FILE_PATH: '/private/resume.PDF' })
    )
  );
});

test('body-size and HTTP server settings are bounded and normalized at startup', () => {
  const defaults = validateRuntimeConfig(createEnvironment());
  assert.deepEqual(defaults.bodyLimits, {
    json: 256 * 1024,
    urlEncoded: 64 * 1024,
  });
  assert.deepEqual(defaults.httpServer, {
    requestTimeoutMs: 300_000,
    headersTimeoutMs: 60_000,
    keepAliveTimeoutMs: 5_000,
    maxHeadersCount: 100,
    maxRequestsPerSocket: 1_000,
  });

  const configured = validateRuntimeConfig(
    createEnvironment({
      HTTP_HEADERS_TIMEOUT_MS: '10000',
      HTTP_KEEP_ALIVE_TIMEOUT_MS: '2500',
      HTTP_MAX_HEADERS_COUNT: '64',
      HTTP_MAX_REQUESTS_PER_SOCKET: '50',
      HTTP_REQUEST_TIMEOUT_MS: '20000',
      JSON_BODY_LIMIT: '1mb',
      URL_ENCODED_BODY_LIMIT: '128KB',
    })
  );
  assert.deepEqual(configured.bodyLimits, {
    json: 1024 * 1024,
    urlEncoded: 128 * 1024,
  });
  assert.deepEqual(configured.httpServer, {
    requestTimeoutMs: 20_000,
    headersTimeoutMs: 10_000,
    keepAliveTimeoutMs: 2_500,
    maxHeadersCount: 64,
    maxRequestsPerSocket: 50,
  });

  assert.throws(
    () =>
      validateRuntimeConfig(createEnvironment({ JSON_BODY_LIMIT: '2mb' })),
    /JSON_BODY_LIMIT must be a byte size between 1024 and 1048576 bytes/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ JSON_BODY_LIMIT: '256kib' })
      ),
    /JSON_BODY_LIMIT must be a byte size/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ URL_ENCODED_BODY_LIMIT: '512kb' })
      ),
    /URL_ENCODED_BODY_LIMIT must be a byte size between 1024 and 262144 bytes/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({
          HTTP_HEADERS_TIMEOUT_MS: '11000',
          HTTP_REQUEST_TIMEOUT_MS: '10000',
        })
      ),
    /HTTP_HEADERS_TIMEOUT_MS cannot exceed HTTP_REQUEST_TIMEOUT_MS/
  );
  assert.throws(
    () =>
      validateRuntimeConfig(
        createEnvironment({ HTTP_MAX_HEADERS_COUNT: '1001' })
      ),
    /HTTP_MAX_HEADERS_COUNT must be an integer between 16 and 1000/
  );
});

test('HTTP server configuration applies every validated connection limit', () => {
  const policy = {
    requestTimeoutMs: 20_000,
    headersTimeoutMs: 10_000,
    keepAliveTimeoutMs: 2_500,
    maxHeadersCount: 64,
    maxRequestsPerSocket: 50,
  };
  const server = {};

  assert.equal(configureHttpServer(server, policy), server);
  assert.equal(server.requestTimeout, policy.requestTimeoutMs);
  assert.equal(server.headersTimeout, policy.headersTimeoutMs);
  assert.equal(server.keepAliveTimeout, policy.keepAliveTimeoutMs);
  assert.equal(server.maxHeadersCount, policy.maxHeadersCount);
  assert.equal(
    server.maxRequestsPerSocket,
    policy.maxRequestsPerSocket
  );
});

test('browser origins reject non-HTTP protocols and embedded credentials', () => {
  assert.throws(
    () => parseAllowedOrigins('file:///tmp/portfolio.html'),
    /invalid URL \(HTTP\(S\) origins only\)/
  );
  assert.throws(
    () => parseAllowedOrigins('https://user:password@portfolio.example.test'),
    /invalid URL \(HTTP\(S\) origins only\)/
  );
});

test('production accepts DATABASE_URL instead of discrete database secrets', () => {
  const config = validateRuntimeConfig(
    createEnvironment({
      DATABASE_URL: 'mysql://portfolio:password@db.internal:3306/portfolio',
      NODE_ENV: 'production',
      REMOTE_CLIENT_APP: 'https://portfolio.example.test',
    })
  );

  assert.equal(config.isProduction, true);
  assert.deepEqual(config.allowedOrigins, ['https://portfolio.example.test']);
});

test('unsafe API requests require an exact configured browser origin', () => {
  const guard = createUnsafeRequestOriginGuard([
    'https://portfolio.example.test',
  ]);
  const run = ({ method, origin }) => {
    let forwardedError;
    let nextCalls = 0;
    guard(
      {
        method,
        get(header) {
          return header === 'origin' ? origin : undefined;
        },
      },
      {},
      (error) => {
        forwardedError = error;
        nextCalls += 1;
      }
    );
    return { forwardedError, nextCalls };
  };

  assert.equal(run({ method: 'GET' }).forwardedError, undefined);
  assert.equal(run({ method: 'OPTIONS' }).forwardedError, undefined);
  assert.equal(
    run({
      method: 'POST',
      origin: 'https://portfolio.example.test',
    }).forwardedError,
    undefined
  );

  const missingOrigin = run({ method: 'POST' });
  assert.equal(missingOrigin.nextCalls, 1);
  assert.equal(missingOrigin.forwardedError.statusCode, 403);

  const siblingOrigin = run({
    method: 'PATCH',
    origin: 'https://evil.example.test',
  });
  assert.equal(siblingOrigin.nextCalls, 1);
  assert.equal(siblingOrigin.forwardedError.statusCode, 403);
});

test('Helmet applies API-safe headers without blocking cross-origin uploads', async (t) => {
  const app = createApp(createEnvironment());
  const server = await listen(app);
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/route-that-does-not-exist`);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(
    response.headers.get('content-security-policy'),
    /default-src 'none'/
  );
  assert.match(
    response.headers.get('content-security-policy'),
    /frame-ancestors 'none'/
  );
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(
    response.headers.get('cross-origin-resource-policy'),
    'cross-origin'
  );
  assert.equal(response.headers.get('strict-transport-security'), null);
});

test('Helmet enables HSTS only for production', async (t) => {
  const app = createApp(
    createEnvironment({
      DATABASE_URL: 'mysql://portfolio:password@db.internal:3306/portfolio',
      NODE_ENV: 'production',
      REMOTE_CLIENT_APP: 'https://portfolio.example.test',
    })
  );
  const server = await listen(app);
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/route-that-does-not-exist`);

  assert.equal(
    response.headers.get('strict-transport-security'),
    'max-age=31536000; includeSubDomains'
  );
});

test('global API limiter returns standard headers and a safe JSON error', async (t) => {
  const app = createApp(
    createEnvironment({
      API_RATE_LIMIT_MAX_REQUESTS: '1',
      API_RATE_LIMIT_WINDOW_MS: '60000',
    })
  );
  const server = await listen(app);
  t.after(server.close);

  const first = await fetch(`${server.baseUrl}/api/route-that-does-not-exist`);
  const blocked = await fetch(`${server.baseUrl}/api/route-that-does-not-exist`);

  assert.equal(first.status, 404);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await first.json(), {
    succeed: false,
    msg: 'Route does not exist',
  });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('cache-control'), 'no-store');
  assert.equal(blocked.headers.has('ratelimit'), true);
  assert.equal(blocked.headers.has('x-ratelimit-limit'), false);
  assert.deepEqual(await blocked.json(), {
    succeed: false,
    msg: 'Too many requests. Please try again later.',
  });
});

test('login and readiness probes have independent stricter limiters', async (t) => {
  const limiters = createRateLimiters({
    adminLogin: { limit: 1, windowMs: 60_000 },
    api: { limit: 100, windowMs: 60_000 },
    readiness: { limit: 1, windowMs: 60_000 },
  });
  const app = express();

  app.set('trust proxy', 0);
  app.post('/login', limiters.adminLogin, (_req, res) => res.sendStatus(204));
  app.get('/ready', limiters.readiness, (_req, res) => res.sendStatus(204));

  const server = await listen(app);
  t.after(server.close);

  assert.equal(
    (await fetch(`${server.baseUrl}/login`, { method: 'POST' })).status,
    204
  );
  const blockedLogin = await fetch(`${server.baseUrl}/login`, {
    method: 'POST',
  });
  assert.equal(blockedLogin.status, 429);
  assert.equal(
    (await blockedLogin.json()).msg,
    'Too many login attempts. Please try again later.'
  );

  // A separate limiter must still have its own untouched budget.
  assert.equal((await fetch(`${server.baseUrl}/ready`)).status, 204);
  const blockedReadiness = await fetch(`${server.baseUrl}/ready`);
  assert.equal(blockedReadiness.status, 429);
  assert.equal(
    (await blockedReadiness.json()).msg,
    'Too many readiness probes. Please try again later.'
  );
});
