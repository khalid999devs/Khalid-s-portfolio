#!/usr/bin/env node
// Runs the dual build, then says whether the committed artefacts moved.
//
// deploy/ is committed, so a build that changes it and is left uncommitted
// means the next deploy ships the previous build -- and nothing reports that:
// CI passes, the push succeeds, and cPanel says it deployed.

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const build = spawnSync('bash', [resolve(ROOT, 'scripts/build-deploy.sh')], {
  cwd: ROOT,
  stdio: 'inherit',
});

if (build.error) {
  console.error(`Could not run the build: ${build.error.message}`);
  process.exit(1);
}
if (build.status !== 0) process.exit(build.status ?? 1);

const status = spawnSync('git', ['status', '--porcelain', 'deploy'], {
  cwd: ROOT,
  encoding: 'utf8',
});

const changed = (status.stdout || '').trim().split('\n').filter(Boolean);

if (changed.length === 0) {
  console.log('deploy/ unchanged — the committed artefacts already match this source.');
} else {
  console.log(`deploy/ changed in ${changed.length} file(s). Commit them, or the`);
  console.log('next deploy ships the previous build:');
  console.log('  git add -A && git commit -m "..." && git push');
}
