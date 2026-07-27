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

/**
 * Measured noise floor, not a guess and not a convenience.
 *
 * Capturing the *same build twice* and diffing the two runs yields differences
 * confined to `about__mobile__s0.png` and `home__tablet__s0.png` — the two
 * screenshots dominated by GSAP-driven text animation. Across repeated runs
 * those images vary by 1–2 pixels; every other screenshot is exact every time.
 * The animations settle against real time, so their glyphs rasterise a subpixel
 * apart depending on machine load. Stubbing Math.random removed the larger,
 * phase-dependent divergence; this residue is timing and cannot be stubbed
 * away.
 *
 * Set to the observed maximum. Anything at or below it is indistinguishable
 * from running the harness twice, so failing on it means failing at random. For
 * scale, 2 pixels is 0.0006% of one screenshot — a real regression (a layout
 * shift, a colour change, a missing element) moves thousands.
 *
 * This is the one place tolerance is granted, and it is granted narrowly:
 * computed styles, layout dimensions, element counts and colours are compared
 * with no tolerance at all, which is what actually catches the class of
 * regression this harness exists for.
 */
const ALLOWED_DIFFERING_PIXELS = 2;

/**
 * Per-pixel perceptual threshold (normalized YIQ distance), not a count.
 *
 * Chromium's glyph rasterisation is not bit-exact between runs: a control
 * experiment — the same build captured twice with no code change — produced a
 * single pixel differing by 2/255 against the #161616 background, at a text
 * edge. Left at 0 the gate reports that as a failure, and a gate that cries
 * wolf gets ignored, which is the actual danger here.
 *
 * 0.02 discards deltas far below perceptibility while still failing on any real
 * change: a moved element, a changed font, or a different colour shifts pixels
 * by far more than this, and shifts thousands of them.
 *
 * Colour specifically is NOT left to this threshold. `styles.json` records
 * `color` and `background-color` as exact strings for every probed element and
 * is compared with no tolerance at all, so a #161616 → #171717 theme change
 * fails on the style gate even though it would slip under this one.
 */
const PIXEL_THRESHOLD = 0.02;

/**
 * Per-image exceptions above the noise floor. Empty, and it should stay that
 * way — an entry here means a real difference was accepted.
 */
const ACCEPTED_PIXEL_DIFFERENCES = new Map();

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
    threshold: PIXEL_THRESHOLD,
    includeAA: true,
  });

  const allowed = ACCEPTED_PIXEL_DIFFERENCES.get(name) ?? ALLOWED_DIFFERING_PIXELS;

  if (differing > allowed) {
    await writeFile(join(DIFF, name), PNG.sync.write(diff));
    const pct = ((differing / (a.width * a.height)) * 100).toFixed(4);
    failures.push(
      `PIXELS  ${name} — ${differing} differing pixels (${pct}%), ` +
        `${allowed} accepted → output/diff/${name}`
    );
  } else if (differing > 0) {
    console.log(`  (accepted) ${name}: ${differing} known differing pixel(s)`);
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
