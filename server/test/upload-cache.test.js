const assert = require('node:assert/strict');
const {
  mkdirSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const http = require('node:http');
const { resolve } = require('node:path');
const test = require('node:test');

const {
  createApp,
  isImmutableUploadPath,
  setUploadCacheHeaders,
} = require('../index');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');

const createEnvironment = () => ({
  ADMIN_SECRET: 'admin-secret-'.padEnd(40, 'a'),
  ADMIN_USERNAME: 'portfolio-admin',
  COOKIE_SECRET: 'cookie-secret-'.padEnd(40, 'b'),
  NODE_ENV: 'test',
  REMOTE_CLIENT_APP: 'http://portfolio.example.test',
});

const listen = (app) =>
  new Promise((resolvePromise, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Test server did not expose a TCP address'));
        return;
      }

      resolvePromise({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) =>
              error ? rejectClose(error) : resolveClose()
            );
          }),
      });
    });
    server.once('error', reject);
  });

const requestHeaders = (url, headers) =>
  new Promise((resolvePromise, reject) => {
    const request = http.get(url, { headers }, (response) => {
      response.resume();
      response.once('end', () => {
        resolvePromise({
          headers: response.headers,
          status: response.statusCode,
        });
      });
    });
    request.once('error', reject);
  });

test('upload cache classification recognizes only generated immutable names', () => {
  assert.equal(
    isImmutableUploadPath(
      resolve(
        UPLOADS_ROOT,
        'projects/42/thumbnailContents/thumbnailContents-1700000000000-0123456789abcdef01234567-optimized.webp'
      )
    ),
    true
  );
  assert.equal(
    isImmutableUploadPath(
      resolve(
        UPLOADS_ROOT,
        'projects/42/videos/videos-1700000000000-0123456789abcdef01234567.mp4'
      )
    ),
    true
  );
  assert.equal(
    isImmutableUploadPath(resolve(UPLOADS_ROOT, 'assets/asset.webp')),
    false
  );
  assert.equal(
    isImmutableUploadPath(
      resolve(
        UPLOADS_ROOT,
        'assets/thumbnailContents-1700000000000-0123456789abcdef01234567-optimized.webp'
      )
    ),
    false
  );
  assert.equal(
    isImmutableUploadPath(
      resolve(
        UPLOADS_ROOT,
        'projects/42/bannerImg/thumbnailContents-1700000000000-0123456789abcdef01234567-optimized.webp'
      )
    ),
    false
  );

  const headers = new Map();
  const response = {
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
  };
  setUploadCacheHeaders(
    response,
    resolve(UPLOADS_ROOT, 'assets/asset.webp')
  );
  assert.equal(
    headers.get('cache-control'),
    'public, no-cache, must-revalidate'
  );
});

test('only current fingerprinted uploads receive immutable caching', async (t) => {
  const projectId = `${Date.now()}${process.pid}`;
  const projectDirectory = resolve(UPLOADS_ROOT, 'projects', projectId);
  const directory = resolve(projectDirectory, 'thumbnailContents');
  const immutableFileName =
    'thumbnailContents-1700000000000-0123456789abcdef01234567-optimized.webp';
  const legacyFileName = 'asset.webp';
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, immutableFileName),
    Buffer.from('immutable-test-asset')
  );
  writeFileSync(
    resolve(directory, legacyFileName),
    Buffer.from('legacy-test-asset')
  );
  t.after(() => rmSync(projectDirectory, { force: true, recursive: true }));

  const server = await listen(createApp(createEnvironment()));
  t.after(server.close);

  const immutableResponse = await fetch(
    `${server.baseUrl}/uploads/projects/${projectId}/thumbnailContents/${immutableFileName}`
  );
  const legacyResponse = await fetch(
    `${server.baseUrl}/uploads/projects/${projectId}/thumbnailContents/${legacyFileName}`
  );

  assert.equal(immutableResponse.status, 200);
  assert.equal(
    immutableResponse.headers.get('cache-control'),
    'public, max-age=31536000, immutable'
  );
  assert.equal(
    immutableResponse.headers.get('x-content-type-options'),
    'nosniff'
  );
  assert.ok(immutableResponse.headers.get('etag'));

  assert.equal(legacyResponse.status, 200);
  assert.equal(
    legacyResponse.headers.get('cache-control'),
    'public, no-cache, must-revalidate'
  );
  assert.equal(legacyResponse.headers.get('x-content-type-options'), 'nosniff');
  const legacyEtag = legacyResponse.headers.get('etag');
  assert.ok(legacyEtag);

  // Use a raw request here: Fetch implementations may transparently combine a
  // conditional 304 with their cached 200 response before exposing it.
  const revalidatedLegacyResponse = await requestHeaders(
    `${server.baseUrl}/uploads/projects/${projectId}/thumbnailContents/${legacyFileName}`,
    { 'If-None-Match': legacyEtag }
  );
  assert.equal(revalidatedLegacyResponse.status, 304);
  assert.equal(
    revalidatedLegacyResponse.headers['cache-control'],
    'public, no-cache, must-revalidate'
  );
});
