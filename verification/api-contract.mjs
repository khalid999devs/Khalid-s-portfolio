/**
 * Records the server's HTTP contract and diffs it against a stored snapshot.
 *
 * This is the gate for Phases 2 and 3: the server is going to be substantially
 * rewritten (allowlists, upload validation, helmet, migrations) and every
 * dependency upgraded. None of that is allowed to change what the client
 * receives, because the client is frozen.
 *
 *   node api-contract.mjs record    write snapshots/api-contract.json
 *   node api-contract.mjs check     compare live server against the snapshot
 *
 * SAFETY: refuses to run against anything but loopback. This suite sends
 * mutating requests — including the public admin-registration probe — and must
 * never be pointed at production.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(HERE, 'snapshots', 'api-contract.json');
const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

const host = new URL(BASE).hostname;
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error(`Refusing to run against "${host}". Loopback only — this suite mutates state.`);
  process.exit(2);
}

const mode = process.argv[2];
if (!['record', 'check'].includes(mode)) {
  console.error('Usage: node api-contract.mjs <record|check>');
  process.exit(2);
}

/**
 * Every request the contract covers. `probe` marks requests that exist to
 * document a vulnerability rather than a feature — their responses are expected
 * to change once the fix lands, and the diff is the evidence.
 */
const REQUESTS = [
  ['GET', '/api/settings'],
  ['GET', '/api/settings/download-resume'],
  ['POST', '/api/projects', { mode: 'all' }],
  ['POST', '/api/projects', { mode: 'cat' }],
  ['POST', '/api/projects', { mode: 'single', projectId: 1 }],
  ['POST', '/api/projects', { mode: 'single' }],
  ['POST', '/api/projects', { mode: 'nonsense' }],
  ['POST', '/api/projects', {}],
  ['GET', '/api/nope'],
  ['GET', '/nope'],

  // Must all reject when logged out. If any of these ever answers 200, the
  // authentication boundary has been broken.
  ['GET', '/api/admin'],
  ['GET', '/api/admin/auth'],
  ['GET', '/api/contact/messages'],
  ['POST', '/api/projects/create', { title: 'x' }],
  ['PATCH', '/api/projects/reorder', { order: [] }],
  ['PATCH', '/api/projects/edit-infos/1', { title: 'x' }],
  ['PATCH', '/api/projects/delete-contents/1', { mode: 'videos' }],
  ['DELETE', '/api/projects/delete/999999'],
  ['POST', '/api/settings/add', {}],
  ['PATCH', '/api/settings/edit/1', {}],
  ['POST', '/api/contact/emailToClient/custom', {}],
  ['POST', '/api/contact/smsToClient/custom', {}],

  ['POST', '/api/admin/login', {}],
  ['POST', '/api/admin/login', { userName: 'nope', password: 'nope' }],
  ['GET', '/api/admin/logout'],

  // S1. Currently answers 201 and hands out a working admin account.
  ['POST', '/api/admin/reg', { userName: 'contract-probe', password: 'x' }, 'probe'],
  ['POST', '/api/admin/reg', {}, 'probe'],
];

const label = (method, path, body) =>
  `${method} ${path}${body && Object.keys(body).length ? ` ${JSON.stringify(body)}` : ''}`;

/** Strips values that legitimately vary between runs. */
const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => {
          if (['createdAt', 'updatedAt', 'id', 'token'].includes(key)) return [key, `<${key}>`];
          return [key, normalize(inner)];
        })
    );
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return '<timestamp>';
  return value;
};

/**
 * Supervises the server under test.
 *
 * Not defensive padding — a request in this suite genuinely kills the process.
 * `GET /api/settings/download-resume` throws inside `res.download`'s async error
 * callback, which escapes Express and terminates Node, so recording the contract
 * without a supervisor stops after the first request. Whether a request survives
 * is itself part of the contract, and `survived: false` is the finding.
 */
const SERVER_DIR = join(HERE, '..', 'server');
let child = null;

const waitForReady = async (attempts = 40) => {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(`${BASE}/api/settings`, { signal: AbortSignal.timeout(1000) });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
};

const startServer = async () => {
  child = spawn(process.execPath, ['index.js'], { cwd: SERVER_DIR, stdio: 'ignore' });
  child.alive = true;
  child.on('exit', () => { child.alive = false; });
  if (!(await waitForReady())) throw new Error('server did not become ready');
};

const supervise = process.argv.includes('--serve');

const record = async () => {
  const results = {};
  if (supervise) await startServer();

  for (const [method, path, body, kind] of REQUESTS) {
    const key = label(method, path, body);
    if (supervise && !child.alive) await startServer();
    try {
      const response = await fetch(`${BASE}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
      });
      const text = await response.text();
      let parsed;
      try {
        parsed = normalize(JSON.parse(text));
      } catch {
        parsed = text.slice(0, 200);
      }
      results[key] = {
        status: response.status,
        contentType: (response.headers.get('content-type') || '').split(';')[0],
        // Header presence, not values — Phase 2 adds helmet and cache policy and
        // this is where that shows up.
        securityHeaders: [
          'content-security-policy',
          'strict-transport-security',
          'x-content-type-options',
          'x-frame-options',
          'referrer-policy',
          'cache-control',
          'set-cookie',
        ].filter((header) => response.headers.has(header)),
        body: parsed,
        ...(kind ? { kind } : {}),
      };
    } catch (error) {
      results[key] = { error: String(error?.message || error) };
    }

    if (supervise) {
      // Give an async post-response throw time to reach the process.
      await new Promise((r) => setTimeout(r, 400));
      results[key].survived = child.alive;
    }
  }
  if (supervise && child.alive) child.kill();
  return results;
};

const live = await record();

if (mode === 'record') {
  await mkdir(dirname(SNAPSHOT), { recursive: true });
  await writeFile(SNAPSHOT, JSON.stringify(live, null, 2));
  console.log(`Recorded ${Object.keys(live).length} requests → ${SNAPSHOT}`);
  process.exit(0);
}

if (!existsSync(SNAPSHOT)) {
  console.error(`No snapshot at ${SNAPSHOT}. Run \`node api-contract.mjs record\` first.`);
  process.exit(2);
}

const stored = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
const differences = [];

for (const key of new Set([...Object.keys(stored), ...Object.keys(live)])) {
  const before = JSON.stringify(stored[key], null, 2);
  const after = JSON.stringify(live[key], null, 2);
  if (before !== after) {
    differences.push({ key, before, after, kind: stored[key]?.kind ?? live[key]?.kind });
  }
}

const intended = differences.filter((d) => d.kind === 'probe');
const unintended = differences.filter((d) => d.kind !== 'probe');

for (const { key, before, after } of unintended) {
  console.error(`\nCHANGED  ${key}\n  before: ${before?.replace(/\n/g, '\n  ')}\n  after:  ${after?.replace(/\n/g, '\n  ')}`);
}
for (const { key } of intended) {
  console.log(`(expected) security probe changed: ${key}`);
}

if (unintended.length) {
  console.error(`\nFAIL — ${unintended.length} unintended contract change(s).`);
  process.exit(1);
}
console.log(`PASS — ${Object.keys(live).length} requests, no unintended contract changes.`);
