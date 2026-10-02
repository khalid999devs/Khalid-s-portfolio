#!/usr/bin/env node
// Ships HEAD: test, build, push, then pull and deploy on the host over SSH and
// confirm the live sites serve what deploy/ holds.
//
//   npm run deploy         full release
//   npm run deploy:check   compare live against HEAD, change nothing
//
// The host is an SSH alias (DEPLOY_SSH_HOST, default "portfolio"). Its address,
// port, user and key belong in ~/.ssh/config, not in this repository.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = process.env.DEPLOY_SSH_HOST || 'portfolio';
const CHECK_ONLY = process.argv.includes('--check');

const API_URL = 'https://api.khalidahammed.com';
const SITES = [
  { name: 'web', origin: 'https://khalidahammed.com' },
  { name: 'upwork', origin: 'https://upwork.khalidahammed.com' },
];

// Remote exit code for "files copied, API left on the previous code".
const NOT_RESTARTED = 10;

const step = (title) => console.log(`\n==> ${title}`);

const fail = (message) => {
  console.error(`\nFAIL: ${message}`);
  process.exit(1);
};

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) fail(`could not run ${command}: ${result.error.message}`);
  return result.status;
};

const git = (...args) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${args.join(' ')}\n${result.stderr}`);
  return result.stdout.trimEnd();
};

const remote = (script, { capture = false } = {}) =>
  spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', HOST, 'bash -s'], {
    input: script,
    encoding: 'utf8',
    stdio: ['pipe', capture ? 'pipe' : 'inherit', 'inherit'],
  });

// Update from Remote, then Deploy HEAD Commit, as cPanel's own API calls.
const deployScript = (sha) => `
repo="$HOME/repositories/my_portfolio"
cd "$repo" || exit 1

dirty=$(git status --porcelain)
if [ -n "$dirty" ]; then
  echo "The checkout on the host has local changes, so cPanel will not deploy:"
  echo "$dirty"
  echo "Look at them there, then restore with: git checkout -- <file>"
  exit 1
fi

uapi --output=json VersionControl update repository_root="$repo" branch=main > /dev/null
head=$(git rev-parse HEAD)
if [ "$head" != "${sha}" ]; then
  echo "checkout is at $head, expected ${sha}"
  exit 1
fi
echo "pulled $(git rev-parse --short HEAD)"

out=$(uapi --output=json VersionControlDeployment create repository_root="$repo")
log=$(printf '%s' "$out" | grep -o '"log_path":"[^"]*"' | cut -d'"' -f4)
if [ -z "$log" ]; then
  echo "$out"
  exit 1
fi

# The deploy is queued, so the log is the only place it reports.
for i in $(seq 1 60); do
  grep -q -E '^(Build completed|Task completed with exit code [1-9])' "$log" 2>/dev/null && break
  sleep 2
done
if ! grep -q '^Build completed with exit code 0' "$log" 2>/dev/null; then
  tail -n 30 "$log" 2>/dev/null
  echo "deploy did not finish cleanly: $log"
  exit 1
fi

grep -E '^(deployed |api restarted|NOT RESTARTED|In Setup Node)' "$log"
grep -q '^NOT RESTARTED' "$log" && exit ${NOT_RESTARTED}
exit 0
`;

function release() {
  step('preflight');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') fail(`on ${branch}; releases go out from main.`);
  console.log('on main');

  step('server tests');
  if (run('npm', ['test']) !== 0) fail('server tests failed.');

  step('build');
  if (run(process.execPath, [resolve(ROOT, 'scripts/build-deploy.mjs')]) !== 0) {
    fail('build failed.');
  }

  const sitemap = readFileSync(resolve(ROOT, 'deploy/web/sitemap.xml'), 'utf8');
  if (!sitemap.includes('singleProject')) {
    fail(
      'the sitemap has no project pages, so the API was unreachable during the build.\n' +
        'Restore it with `git checkout deploy/web/sitemap.xml` and run this again.'
    );
  }

  // Only committed files ship, so anything left over would be silently absent.
  const dirty = git('status', '--porcelain');
  if (dirty) {
    console.error(`\n${dirty}`);
    fail('uncommitted changes. Commit them, then run this again.');
  }

  step('push');
  if (run('git', ['push', 'origin', 'main']) !== 0) fail('push was rejected.');

  const sha = git('rev-parse', 'HEAD');

  step('pull and deploy on the host');
  const { status } = remote(deployScript(sha));
  if (status !== 0 && status !== NOT_RESTARTED) fail('the host did not deploy.');

  return { sha, restarted: status === 0 };
}

const get = async (url) => {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    return { status: 0, body: Buffer.alloc(0), error: error.message };
  }
};

async function verify(sha) {
  const problems = [];

  step('host state');
  const state = remote(
    'cd "$HOME/repositories/my_portfolio" && git rev-parse HEAD && ' +
      'cat "$HOME/last-deploy.txt" && git status --porcelain | wc -l',
    { capture: true }
  );
  if (state.status !== 0) fail(`could not read the host over SSH as "${HOST}".`);

  const [checkout, deployed, dirtyCount] = state.stdout.trim().split('\n').map((s) => s.trim());
  console.log(`checkout ${checkout.slice(0, 7)}, last deployed ${deployed.slice(0, 7)}`);
  if (deployed !== sha) {
    problems.push(`the host last deployed ${deployed.slice(0, 7)}, not ${sha.slice(0, 7)}`);
  }
  if (dirtyCount !== '0') {
    problems.push('the checkout on the host has local changes; the next deploy will be refused');
  }

  step('live sites');
  for (const site of SITES) {
    const dir = resolve(ROOT, 'deploy', site.name);
    const index = readFileSync(resolve(dir, 'index.html'), 'utf8');

    // Everything index.html loads from this origin, plus the crawler files.
    const paths = new Set(['/', '/robots.txt', '/sitemap.xml']);
    for (const match of index.matchAll(/(?:src|href)="(\/[^"/][^"]*)"/g)) paths.add(match[1]);

    let matched = 0;
    for (const path of paths) {
      const file = resolve(dir, path === '/' ? 'index.html' : `.${path}`);
      if (!existsSync(file)) continue;

      const live = await get(`${site.origin}${path}`);
      if (live.status !== 200) {
        problems.push(`${site.origin}${path} answered ${live.status || live.error}`);
      } else if (!live.body.equals(readFileSync(file))) {
        problems.push(`${site.origin}${path} differs from deploy/${site.name}${path}`);
      } else {
        matched += 1;
      }
    }
    console.log(`${site.name}: ${matched} file(s) match deploy/${site.name}`);
  }

  // A restart takes a few seconds to come back, hence the retries.
  step('api');
  let api = { status: 0 };
  for (let attempt = 0; attempt < 15 && api.status !== 200; attempt += 1) {
    if (attempt > 0) await sleep(3000);
    api = await get(`${API_URL}/api/settings`);
  }
  console.log(`GET /api/settings ${api.status || api.error}`);
  if (api.status !== 200) problems.push(`the API answered ${api.status || api.error}`);

  if (problems.length > 0) {
    console.error('');
    for (const problem of problems) console.error(`  - ${problem}`);
    fail(`live does not match ${sha.slice(0, 7)}.`);
  }
  console.log(`\nLive matches ${sha.slice(0, 7)}.`);
}

if (CHECK_ONLY) {
  await verify(git('rev-parse', 'HEAD'));
} else {
  const { sha, restarted } = release();
  await verify(sha);
  if (!restarted) {
    fail(
      'the files are deployed but the API still runs the previous code.\n' +
        'In cPanel -> Setup Node.js App run NPM Install and/or the migrate script, then Restart.'
    );
  }
}
