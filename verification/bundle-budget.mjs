/**
 * Records and enforces gzip bundle budgets for `client/dist`.
 *
 *   node bundle-budget.mjs record   store current sizes as the ceiling
 *   node bundle-budget.mjs check    fail if anything grew
 *
 * Sizes are grouped by role rather than by filename, because filenames carry
 * content hashes and chunk names change the moment splitting is introduced in
 * Phase 5. The budget asserts what actually matters: how many bytes a first-time
 * public visitor must download before the page can render.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(HERE, 'snapshots', 'bundle-budget.json');
const DIST = join(HERE, '..', 'client', 'dist');
const ASSETS = join(DIST, 'assets');

const mode = process.argv[2];
if (!['record', 'check'].includes(mode)) {
  console.error('Usage: node bundle-budget.mjs <record|check>');
  process.exit(2);
}
if (!existsSync(ASSETS)) {
  console.error(`No build at ${ASSETS}. Run \`npm run build\` in client/ first.`);
  process.exit(2);
}

/**
 * The critical set is read from index.html rather than guessed from filenames.
 *
 * A filename heuristic was wrong the moment code splitting was introduced: it
 * classified the new vendor chunks as "lazy" purely because they were no longer
 * called `index-*`, which would have reported a large critical-path reduction
 * that had not happened. What a first-time visitor must download before render
 * is exactly the entry script plus everything `<link rel="modulepreload">`
 * points at, so that is what gets measured.
 */
const criticalAssetsFromHtml = async () => {
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  const names = new Set();
  for (const match of html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)) {
    names.add(match[1]);
  }
  return names;
};

const measure = async () => {
  const files = await readdir(ASSETS);
  const critical = await criticalAssetsFromHtml();
  const totals = { criticalJs: 0, criticalCss: 0, lazyJs: 0 };
  const perFile = {};

  for (const file of files) {
    const ext = extname(file);
    if (!['.js', '.css'].includes(ext)) continue;

    const gzip = gzipSync(await readFile(join(ASSETS, file)), { level: 9 }).length;
    perFile[file] = gzip;

    if (ext === '.css') totals.criticalCss += gzip;
    else if (critical.has(file)) totals.criticalJs += gzip;
    else totals.lazyJs += gzip;
  }

  // The GLB is served from public/ and is not a bundle, but it dominates the
  // homepage's byte cost and belongs in the same conversation.
  const glb = join(HERE, '..', 'client', 'public', 'scene.glb');
  totals.sceneGlb = existsSync(glb) ? (await readFile(glb)).length : 0;

  return { totals, perFile };
};

const { totals, perFile } = await measure();

const report = () => {
  const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;
  console.log('  critical JS (gzip):', kib(totals.criticalJs), '  <- blocks first render');
  console.log('  critical CSS(gzip):', kib(totals.criticalCss));
  console.log('  lazy JS     (gzip):', kib(totals.lazyJs));
  console.log('  scene.glb   (raw) :', kib(totals.sceneGlb));
};

if (mode === 'record') {
  await mkdir(dirname(SNAPSHOT), { recursive: true });
  await writeFile(SNAPSHOT, JSON.stringify({ totals, perFile }, null, 2));
  console.log(`Recorded budgets → ${SNAPSHOT}`);
  report();
  process.exit(0);
}

if (!existsSync(SNAPSHOT)) {
  console.error(`No snapshot at ${SNAPSHOT}. Run \`node bundle-budget.mjs record\` first.`);
  process.exit(2);
}

const stored = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
const regressions = [];
for (const [key, ceiling] of Object.entries(stored.totals)) {
  if (totals[key] > ceiling) {
    regressions.push(
      `${key}: ${(totals[key] / 1024).toFixed(1)} KiB exceeds recorded ${(ceiling / 1024).toFixed(1)} KiB`
    );
  }
}

report();
if (regressions.length) {
  console.error('\nFAIL — bundle grew:');
  for (const line of regressions) console.error(`  ${line}`);
  process.exit(1);
}
console.log('\nPASS — nothing grew against the recorded budget.');
