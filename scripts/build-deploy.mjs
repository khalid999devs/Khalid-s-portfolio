#!/usr/bin/env node
// Runs the dual build, then says whether the committed artefacts moved.
//
// deploy/ is committed, so a build that changes it and is left uncommitted
// means the next deploy ships the previous build -- and nothing reports that:
// CI passes, the push succeeds, and cPanel says it deployed.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Before the build, not after: a malformed task is cheap to catch and the
// deploy only reports it as a bash syntax error on the server.
const check = spawnSync('node', [resolve(ROOT, 'scripts/check-cpanel-yml.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (check.status !== 0) process.exit(check.status ?? 1);

const build = spawnSync('bash', [resolve(ROOT, 'scripts/build-deploy.sh')], {
  cwd: ROOT,
  stdio: 'inherit',
});

if (build.error) {
  console.error(`Could not run the build: ${build.error.message}`);
  process.exit(1);
}
if (build.status !== 0) process.exit(build.status ?? 1);

// The sitemap is built from the live catalogue, and the generator treats an
// unreachable API as a warning so a release is not blocked by it. That is the
// right call, but it means building while the API is down silently drops every
// project page -- which is easy to commit without noticing.
const sitemap = readFileSync(resolve(ROOT, 'deploy/web/sitemap.xml'), 'utf8');
const projectPages = (sitemap.match(/singleProject/g) || []).length;
if (projectPages === 0) {
  console.warn('\nWARNING: the sitemap has no project pages.');
  console.warn('The catalogue API was unreachable. Do not commit this sitemap --');
  console.warn('restore it with `git checkout deploy/web/sitemap.xml` and rebuild');
  console.warn('once the API answers.\n');
}

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
