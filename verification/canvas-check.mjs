/**
 * Compares the 3D bot itself, which the main visual gate deliberately does not.
 *
 * `capture.mjs` masks every `<canvas>` before screenshotting, because GPU
 * rasterisation is not reproducible pixel for pixel and would make the gate
 * fire at random. It asserts the canvas structurally instead — present, sized,
 * with a live WebGL context — which catches "the bot vanished" but not "the bot
 * renders differently".
 *
 * That gap does not matter for most changes. It matters enormously for one:
 * upgrading three.js, @react-three/fiber or drei, where a changed colour space,
 * tone mapping default or light unit silently restyles the model while every
 * DOM probe stays identical.
 *
 * So this captures the canvas region unmasked from both builds and reports the
 * difference. It is a report, not a gate — read the numbers and look at the
 * images in output/canvas/. A few percent of edge pixels is rasterisation; a
 * large number, or a shifted mean colour, is the model actually changing.
 *
 *   node canvas-check.mjs              baseline vs candidate
 *   node canvas-check.mjs --self-test  baseline vs baseline
 *
 * Run the self-test first and always. The model has a continuous idle
 * animation driven by real time, which nothing here stubs -- Date.now() has to
 * stay live for GSAP -- so the two loads are photographed at different points
 * of the same animation and a raw pixel percentage means nothing on its own.
 * The self-test is the number to compare against.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { serveDist } from './static-server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BASELINE_DIST = resolve(REPO, '..', 'my_portfolio-baseline', 'client', 'dist');
const CANDIDATE_DIST = join(REPO, 'client', 'dist');
const OUT = join(HERE, 'output', 'canvas');

for (const [label, dist] of [['baseline', BASELINE_DIST], ['candidate', CANDIDATE_DIST]]) {
  if (!existsSync(dist)) {
    console.error(`Missing ${label} build at ${dist}.`);
    process.exit(2);
  }
}

const assertPortsFree = async () => {
  for (const port of [8000, 4180, 4181]) {
    const inUse = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1200) })
      .then(() => true)
      .catch((error) => error.name === 'TimeoutError');
    if (inUse) {
      console.error(`[canvas] Port ${port} is in use. Stop it first.`);
      process.exit(2);
    }
  }
};

/**
 * Same stubs the main harness installs. The bot's entrance is time-driven, and
 * `Math.random` feeds unrelated text animation, so both must be pinned or the
 * two builds are photographed at different moments of the same animation.
 */
const DETERMINISM = `
  (() => {
    Math.random = () => 0.42;
    Date.prototype.toLocaleTimeString = function () { return '12:00:00 PM'; };
    Date.prototype.toLocaleDateString = function () { return '1/1/2026'; };
    Date.prototype.toLocaleString = function () { return '1/1/2026, 12:00:00 PM'; };
  })();
`;

const shoot = async (browser, baseUrl, label) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    timezoneId: 'UTC',
    locale: 'en-US',
    reducedMotion: 'no-preference',
  });
  await context.addInitScript(DETERMINISM);
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  // 3s app loader, then Scene waits 1200ms before mounting the Canvas, then the
  // GLB has to download and the first frames have to render.
  await page.waitForTimeout(9000);
  await page.mouse.move(-50, -50);

  const canvas = page.locator('canvas').first();
  if ((await canvas.count()) === 0) {
    await context.close();
    return { missing: true };
  }
  await canvas.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(4000);

  // A burst, not a single frame. The model plays a looping GLTF clip off the
  // wall clock, so one screenshot from each build catches two arbitrary points
  // of the same animation and the difference between them is dominated by
  // phase. Sampling across the cycle lets the comparison ask the question that
  // actually matters: does every pose one build produces have a match in the
  // other's cycle?
  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    const buffer = await canvas.screenshot({ caret: 'hide' });
    frames.push(PNG.sync.read(buffer));
    if (i === 0) await writeFile(join(OUT, `${label}.png`), buffer);
    await page.waitForTimeout(FRAME_GAP_MS);
  }
  await context.close();
  return { frames };
};

const FRAMES = 14;
const FRAME_GAP_MS = 140;

/** Difference between two frames as a percentage of the canvas. */
const differencePct = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  const differing = pixelmatch(a.data, b.data, null, a.width, a.height, {
    threshold: 0.1,
    includeAA: true,
  });
  return (differing / (a.width * a.height)) * 100;
};

/** Mean channel values — a tone-mapping or colour-space change moves these. */
const meanColour = (png) => {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
  }
  return [r / n, g / n, b / n].map((v) => v.toFixed(2));
};

await assertPortsFree();
await mkdir(OUT, { recursive: true });

const mock = spawn(process.execPath, [join(HERE, 'mock-api.mjs')], { stdio: 'ignore' });
const baselineServer = await serveDist(BASELINE_DIST, 4180);
const candidateServer = await serveDist(CANDIDATE_DIST, 4181);

let exitCode = 0;
try {
  const browser = await chromium.launch({
    args: [
      '--enable-unsafe-swiftshader',
      '--force-color-profile=srgb',
      '--disable-skia-runtime-opts',
      '--deterministic-mode',
      '--hide-scrollbars',
    ],
  });

  const selfTest = process.argv.includes('--self-test');
  const base = await shoot(browser, 'http://127.0.0.1:4180', 'baseline');
  const cand = await shoot(
    browser,
    selfTest ? 'http://127.0.0.1:4180' : 'http://127.0.0.1:4181',
    selfTest ? 'baseline-again' : 'candidate'
  );
  if (selfTest) console.log('SELF-TEST: baseline captured twice, no code difference');
  await browser.close();

  if (base.missing || cand.missing) {
    console.error(`FAIL — canvas missing (baseline: ${!base.missing}, candidate: ${!cand.missing})`);
    exitCode = 1;
  } else {
    const a = base.frames[0];
    const b = cand.frames[0];
    if (a.width !== b.width || a.height !== b.height) {
      console.error(`FAIL — canvas size ${a.width}x${a.height} → ${b.width}x${b.height}`);
      exitCode = 1;
    } else {
      // For each candidate pose, how close is the nearest baseline pose? If the
      // model, materials and lighting are unchanged, every pose the candidate
      // produces occurs somewhere in the baseline's cycle too, so these minima
      // are small. A genuine rendering change raises the floor for every frame
      // at once, because no baseline pose matches any more.
      const minima = cand.frames.map((frame) =>
        Math.min(...base.frames.map((other) => differencePct(frame, other)))
      );
      const sorted = [...minima].sort((x, y) => x - y);
      const median = sorted[Math.floor(sorted.length / 2)];

      // Worst case within one build's own cycle, for scale: this is how far
      // apart two poses of the *same* model get.
      const spread = Math.max(
        ...base.frames.map((frame) =>
          Math.max(...base.frames.map((other) => differencePct(frame, other)))
        )
      );

      const meanBase = meanColour(a);
      const meanCand = meanColour(b);

      console.log(`canvas ${a.width}x${a.height}, ${FRAMES} frames per build`);
      console.log(`  nearest-pose difference : best ${sorted[0].toFixed(2)}%  ` +
        `median ${median.toFixed(2)}%  worst ${sorted[sorted.length - 1].toFixed(2)}%`);
      console.log(`  pose spread within baseline's own cycle: ${spread.toFixed(2)}%`);
      console.log(`  mean RGB : ${meanBase.join(', ')}  →  ${meanCand.join(', ')}`);
      console.log(`  images → ${OUT}`);
    }
  }
} catch (error) {
  console.error(`[canvas] ${error.message}`);
  exitCode = 1;
} finally {
  mock.kill();
  baselineServer.close();
  candidateServer.close();
}

process.exit(exitCode);
