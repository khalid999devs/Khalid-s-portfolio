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

const mock = spawn(process.execPath, [join(HERE, 'mock-api.mjs')], { stdio: 'ignore' });
const baselineServer = await serveDist(BASELINE_DIST, 4180);
const candidateServer = await serveDist(CANDIDATE_DIST, 4181);
log('mock API :8000 · baseline :4180 · candidate :4181');

let exitCode = 0;
try {
  if (!candidateOnly) {
    log('capturing baseline…');
    const base = await capture('baseline', 'http://127.0.0.1:4180');
    log(`baseline: ${base.shots} screenshots`);
  } else {
    log('reusing existing baseline capture');
  }

  log('capturing candidate…');
  const cand = await capture('candidate', 'http://127.0.0.1:4181');
  log(`candidate: ${cand.shots} screenshots`);

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
