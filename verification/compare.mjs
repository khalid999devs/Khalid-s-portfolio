/**
 * Compares `output/baseline` against `output/candidate` and fails on any
 * difference. Exit code is the gate: 0 means the candidate is visually and
 * structurally indistinguishable from the frozen known-good build.
 */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'output', 'baseline');
const CAND = join(HERE, 'output', 'candidate');
const DIFF = join(HERE, 'output', 'diff');

// Zero. Not "small". A tolerance here is a licence for drift to accumulate
// across phases, and each phase would individually look clean.
const ALLOWED_DIFFERING_PIXELS = 0;

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

const failures = [];

if (!existsSync(BASE) || !existsSync(CAND)) {
  console.error('Missing capture output. Run the baseline and candidate passes first.');
  process.exit(2);
}

await mkdir(DIFF, { recursive: true });

// ---- screenshots -----------------------------------------------------------
const baseShots = (await readdir(BASE)).filter((f) => f.endsWith('.png')).sort();
const candShots = (await readdir(CAND)).filter((f) => f.endsWith('.png')).sort();

for (const name of new Set([...baseShots, ...candShots])) {
  if (!baseShots.includes(name)) {
    failures.push(`EXTRA   ${name} — candidate produced a screenshot the baseline did not`);
    continue;
  }
  if (!candShots.includes(name)) {
    failures.push(`MISSING ${name} — candidate did not produce this screenshot`);
    continue;
  }

  const a = PNG.sync.read(await readFile(join(BASE, name)));
  const b = PNG.sync.read(await readFile(join(CAND, name)));

  if (a.width !== b.width || a.height !== b.height) {
    failures.push(
      `SIZE    ${name} — ${a.width}x${a.height} vs ${b.width}x${b.height} (layout height changed)`
    );
    continue;
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const differing = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0,
    includeAA: true,
  });

  if (differing > ALLOWED_DIFFERING_PIXELS) {
    await writeFile(join(DIFF, name), PNG.sync.write(diff));
    const pct = ((differing / (a.width * a.height)) * 100).toFixed(4);
    failures.push(`PIXELS  ${name} — ${differing} differing pixels (${pct}%) → output/diff/${name}`);
  }
}

// ---- computed styles -------------------------------------------------------
const baseStyles = await readJson(join(BASE, 'styles.json'));
const candStyles = await readJson(join(CAND, 'styles.json'));

for (const key of new Set([...Object.keys(baseStyles), ...Object.keys(candStyles)])) {
  const a = baseStyles[key];
  const b = candStyles[key];

  if (a?.['#error'] || b?.['#error']) {
    failures.push(
      `ERROR   ${key} — baseline: ${a?.['#error'] ?? 'ok'} | candidate: ${b?.['#error'] ?? 'ok'}`
    );
    continue;
  }

  for (const selector of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const left = JSON.stringify(a?.[selector]);
    const right = JSON.stringify(b?.[selector]);
    if (left === right) continue;

    // Report the first differing property rather than dumping both blobs.
    let detail = '';
    if (Array.isArray(a?.[selector]) && Array.isArray(b?.[selector])) {
      if (a[selector].length !== b[selector].length) {
        detail = `element count ${a[selector].length} → ${b[selector].length}`;
      } else {
        for (let i = 0; i < a[selector].length && !detail; i++) {
          for (const prop of Object.keys(a[selector][i])) {
            if (a[selector][i][prop] !== b[selector][i][prop]) {
              detail = `[${i}] ${prop}: "${a[selector][i][prop]}" → "${b[selector][i][prop]}"`;
              break;
            }
          }
        }
      }
    } else {
      detail = `${left} → ${right}`;
    }
    failures.push(`STYLE   ${key} ${selector} — ${detail}`);
  }
}

// ---- verdict ---------------------------------------------------------------
if (failures.length === 0) {
  console.log(`PASS — ${baseShots.length} screenshots and every computed-style probe are identical.`);
  process.exit(0);
}

console.error(`FAIL — ${failures.length} difference(s) between baseline and candidate:\n`);
for (const failure of failures.slice(0, 80)) console.error(`  ${failure}`);
if (failures.length > 80) console.error(`  … and ${failures.length - 80} more`);
process.exit(1);
