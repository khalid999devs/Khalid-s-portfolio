/**
 * Deterministic stand-in for the portfolio API, used only by the visual
 * regression harness.
 *
 * The harness compares a candidate build against the frozen baseline worktree
 * pixel for pixel. That is only meaningful if both builds receive byte-identical
 * data, so this serves recorded fixtures rather than talking to MySQL: the local
 * database holds test rows and an empty settings table, which would leave most
 * of the real UI unrendered and therefore unverified.
 *
 * Fixtures under `fixtures/` were recorded from the public read endpoints of
 * https://api.khalidahammed.com — the same requests a browser makes on any
 * visit. Refresh them with `npm run verify:record`.
 *
 * Listens on 8000 because `client/src/axios/requests.js` hardcodes that origin.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(HERE, 'fixtures', 'api');
const MEDIA_DIR = join(HERE, 'fixtures', 'media');
const PORT = Number(process.env.MOCK_API_PORT || 8000);

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
};

const json = async (name) =>
  JSON.parse(await readFile(join(API_DIR, name), 'utf8'));

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    // No caching anywhere: a cached response between the baseline run and the
    // candidate run would silently invalidate the comparison.
    'Cache-Control': 'no-store',
    // Identifies this process as the fixture server. run.mjs checks for it
    // after every capture, because "port 8000 was free when we started" is not
    // the same claim as "our mock answered every request in this run".
    'X-Verify-Mock': '1',
    ...headers,
  });
  res.end(body);
};

const sendJson = (res, status, value) =>
  send(res, status, JSON.stringify(value), {
    'Content-Type': 'application/json',
  });

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

const serveMedia = async (res, urlPath) => {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, '');
  // Confine to the media root. The fixture paths themselves are trusted, but
  // this server binds a port and should not be the weakest link on the machine.
  const resolved = normalize(join(MEDIA_DIR, relative));
  if (!resolved.startsWith(MEDIA_DIR + sep)) return send(res, 403, 'forbidden');
  if (!existsSync(resolved)) return send(res, 404, 'not found');

  const info = await stat(resolved);
  if (!info.isFile()) return send(res, 404, 'not found');

  const ext = resolved.slice(resolved.lastIndexOf('.')).toLowerCase();
  send(res, 200, await readFile(resolved), {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': String(info.size),
  });
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (pathname.startsWith('/uploads/')) return serveMedia(res, pathname);

  if (pathname === '/api/settings' && req.method === 'GET') {
    return sendJson(res, 200, await json('settings.json'));
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    const { mode, projectId } = await readBody(req);

    if (mode === 'all') return sendJson(res, 200, await json('projects.json'));
    if (mode === 'cat') return sendJson(res, 200, await json('categories.json'));
    if (mode === 'single') {
      const file = join(API_DIR, `project-${Number(projectId)}.json`);
      if (!existsSync(file)) {
        return sendJson(res, 400, {
          succeed: false,
          msg: 'Project Id must be provided!',
        });
      }
      return sendJson(res, 200, JSON.parse(await readFile(file, 'utf8')));
    }
    return sendJson(res, 200, { succeed: true, msg: 'ok', result: undefined });
  }

  // Admin routes are unauthenticated here and answer exactly as the real server
  // does for a logged-out visitor, so /admin and /admin-login render their
  // real signed-out states.
  if (pathname === '/api/admin/auth') {
    return sendJson(res, 401, { msg: 'admin not logged in' });
  }

  send(res, 404, 'Route does not exist');
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`mock-api listening on http://127.0.0.1:${PORT}\n`);
});
