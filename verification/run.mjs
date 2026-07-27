/**
 * Orchestrates a full comparison:
 *
 *   mock API on :8000  (identical fixture data for both builds)
 *   baseline dist on :4180   ← frozen worktree at bf1d462
 *   candidate dist on :4181  ← the working tree
 *
 * Captures both, then diffs. Exit code is the gate.
 *
 *   node run.mjs                 both passes, then compare
 *   node run.mjs --candidate     re-capture the candidate only, then compare
 *                                (baseline output is reusable — it never changes)
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { serveDist } from './static-server.mjs';
import { capture } from './capture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BASELINE_DIST = resolve(REPO, '..', 'my_portfolio-baseline', 'client', 'dist');
const CANDIDATE_DIST = join(REPO, 'client', 'dist');

const candidateOnly = process.argv.includes('--candidate');

const log = (message) => process.stdout.write(`[verify] ${message}\n`);

const run = (command, args, cwd) =>
  new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`${command} exited ${code}`))));
  });

for (const [label, dist] of [['baseline', BASELINE_DIST], ['candidate', CANDIDATE_DIST]]) {
  if (!existsSync(dist)) {
    console.error(`Missing ${label} build at ${dist}. Run \`npm run build\` there first.`);
    process.exit(2);
  }
}

/**
 * Refuse to run if anything already holds a port we need.
 *
 * `spawn` with `stdio: 'ignore'` swallows EADDRINUSE, so a real server left
 * running on 8000 silently answers in the mock's place. That happened: both
 * captures hit the live API, exhausted its 300-request rate limit partway
 * through, and produced pages missing their images and buttons -- which read
 * as a serious regression until the cause was traced. Fail loudly instead.
 */
const assertPortsFree = async () => {
  for (const port of [8000, 4180, 4181]) {
    const inUse = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1200),
    })
      .then(() => true)
      .catch((error) => error.name === 'TimeoutError');

    if (inUse) {
      console.error(
        `[verify] Port ${port} is already in use. Stop whatever holds it ` +
          `(lsof -ti:${port} | xargs kill) — otherwise it answers in place of the ` +
          `harness and the comparison is meaningless.`
      );
      process.exit(2);
    }
  }
};

/**
 * Confirms the fixture server -- not something else -- is answering on 8000.
 *
 * `assertPortsFree` runs once, before anything starts, so it only catches a
 * server that was already listening. A process that binds 8000 *during* a
 * capture is invisible to it, and that is not hypothetical: a `npm test` run
 * started mid-capture took the port, the app's project requests went to the
 * real API instead of the fixtures, and the pages rendered with data missing.
 * The comparison then reported img 3 -> 0 and the home page losing 6,700px,
 * which reads exactly like a catastrophic regression and was nothing of the
 * kind. Checked after every pass, so a contaminated run fails instead of
 * producing a plausible lie.
 */
const assertMockIsAnswering = async (when) => {
  // Retries because the first call happens right after spawn, before the mock
  // has finished binding -- without this the guard fails the run it is meant to
  // protect. Later calls answer on the first attempt.
  let response = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    response = await fetch('http://127.0.0.1:8000/api/settings', {
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    if (response) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (response?.headers.get('x-verify-mock') === '1') return;

  // Throws rather than calling process.exit, because this runs inside the try
  // whose finally kills the mock and closes both static servers. Exiting here
  // skipped that cleanup and leaked the mock, which then held port 8000 and
  // made the *next* run fail on the start-up guard instead -- a failure that
  // points at the user's machine rather than at this bug.
  throw new Error(
    `${when}: port 8000 is not the fixture server` +
      `${response ? ' (something else answered)' : ' (nothing answered)'}. ` +
      `Every capture in this run may have received real API data or none at ` +
      `all — the comparison is void. Stop whatever holds the port and re-run.`
  );
};

await assertPortsFree();

const mock = spawn(process.execPath, [join(HERE, 'mock-api.mjs')], { stdio: 'ignore' });
const baselineServer = await serveDist(BASELINE_DIST, 4180);
const candidateServer = await serveDist(CANDIDATE_DIST, 4181);
log('mock API :8000 · baseline :4180 · candidate :4181');

let exitCode = 0;
try {
  await assertMockIsAnswering('before capture');

  if (!candidateOnly) {
    log('capturing baseline…');
    const base = await capture('baseline', 'http://127.0.0.1:4180');
    log(`baseline: ${base.shots} screenshots`);
    await assertMockIsAnswering('after baseline capture');
  } else {
    log('reusing existing baseline capture');
  }

  log('capturing candidate…');
  const cand = await capture('candidate', 'http://127.0.0.1:4181');
  log(`candidate: ${cand.shots} screenshots`);
  await assertMockIsAnswering('after candidate capture');

  log('comparing…');
  await run(process.execPath, [join(HERE, 'compare.mjs')], HERE);
} catch (error) {
  console.error(`[verify] ${error.message}`);
  exitCode = 1;
} finally {
  mock.kill();
  baselineServer.close();
  candidateServer.close();
}

process.exit(exitCode);
