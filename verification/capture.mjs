/**
 * Captures one build's rendering into `output/<target>/`.
 *
 * Two artifacts per route/viewport/scroll position:
 *   - a PNG, compared later at zero pixel tolerance
 *   - a computed-style probe, compared later as exact JSON
 *
 * The probe exists because a screenshot alone is not sufficient evidence. When
 * this site was last upgraded, every Tailwind spacing utility silently computed
 * to `0px`; the page still rendered something plausible and the regression was
 * missed. Recording `padding`, `margin`, `font-family` and friends per element
 * makes that class of collapse impossible to overlook.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 860, height: 1180 },
  { name: 'desktop', width: 1920, height: 1080 },
];

export const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'projects', path: '/projects' },
  { name: 'about', path: '/about-me' },
  { name: 'coding-lab', path: '/coding-lab' },
  { name: 'single-project', path: '/singleProject/chemgenie' },
  { name: 'admin-login', path: '/admin-login' },
  { name: 'error', path: '/error' },
  { name: 'unknown-url', path: '/this-route-does-not-exist' },
];

/**
 * Elements probed for computed style. Chosen to cover every mechanism that could
 * silently break: Tailwind spacing/sizing utilities, the five custom font
 * families, the four theme colours, the custom `screen-max-width` /
 * `body-max-width` container rules, and the fixed cursor-grid layer.
 */
const PROBE_PROPS = [
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'width', 'height', 'max-width', 'min-height',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'color', 'background-color', 'border-radius', 'border-width',
  'display', 'position', 'z-index', 'opacity', 'transform',
  'gap', 'grid-template-columns', 'flex-direction', 'justify-content', 'align-items',
  'text-transform', 'overflow', 'box-shadow',
];

const PROBE_SELECTORS = [
  'body', '#root',
  '.body-max-width', '.screen-max-width', '.blocks-container', '#blocks', '.block',
  'h1', 'h2', 'h3', 'p', 'a', 'button', 'img', 'nav', 'footer', 'canvas',
  '.text-montreal-mono', '.text-pp-eiko', '.text-montreal-medium',
  '.text-montreal-regular', '.text-rox-italic', '.box-big-shadow',
];

/**
 * Removes the two sources of run-to-run variance in this app.
 *
 * 1. Randomised entrance animations. Every text blink, word opacity, and
 *    per-letter duration on this site is randomised, so without a seeded PRNG
 *    the captures differ from themselves between runs — and a harness that is
 *    noisy against itself cannot prove anything about a change.
 *
 * 2. Live clocks. The footer and the page nav both render
 *    `new Date().toLocaleTimeString()` on a one-second interval, which made the
 *    first self-test report differences on byte-identical builds.
 *
 * Only the *formatting* method is frozen, not `Date.now()` or the constructor:
 * GSAP's ticker reads the clock, and stopping time would stall every animation
 * the harness is here to inspect.
 */
const DETERMINISM_SCRIPT = `
  (() => {
    let seed = 0x2f6e2b1;
    Math.random = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 1e9) / 1e9;
    };
    Date.prototype.toLocaleTimeString = function () { return '12:00:00 PM'; };
    Date.prototype.toLocaleDateString = function () { return '1/1/2026'; };
    Date.prototype.toLocaleString = function () { return '1/1/2026, 12:00:00 PM'; };
  })();
`;

const APP_READY = '.blocks-container, .loader-container, main, #root > *';

export async function capture(target, baseUrl, { settleMs = 9000 } = {}) {
  const outDir = join(HERE, 'output', target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    args: [
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--force-color-profile=srgb',
      '--disable-skia-runtime-opts',
      '--deterministic-mode',
      '--hide-scrollbars',
    ],
  });

  const styles = {};
  const manifest = [];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      timezoneId: 'UTC',
      locale: 'en-US',
      reducedMotion: 'no-preference',
    });
    await context.addInitScript(DETERMINISM_SCRIPT);

    for (const route of ROUTES) {
      const page = await context.newPage();
      const key = `${route.name}__${viewport.name}`;

      try {
        await page.goto(`${baseUrl}${route.path}`, {
          waitUntil: 'networkidle',
          timeout: 60000,
        });
        await page.waitForSelector(APP_READY, { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);

        // The app holds a hard 3s loader before mounting, then runs entrance
        // animations. Wait past both rather than racing them.
        await page.waitForTimeout(settleMs);

        // Park the pointer off-canvas so the cursor grid never highlights.
        await page.mouse.move(-50, -50);
        await page.waitForTimeout(800);

        const pageHeight = await page.evaluate(
          () => document.documentElement.scrollHeight
        );
        const steps = Math.min(6, Math.max(1, Math.ceil(pageHeight / viewport.height)));

        for (let step = 0; step < steps; step++) {
          const y = step * viewport.height;
          await page.evaluate((top) => {
            window.lenis?.scrollTo(top, { immediate: true });
            window.scrollTo({ top, behavior: 'instant' });
          }, y);
          // Scroll-triggered timelines need to run out before capture.
          await page.waitForTimeout(2500);

          const shot = `${key}__s${step}.png`;
          await page.screenshot({
            path: join(outDir, shot),
            animations: 'disabled',
            caret: 'hide',
            // The 3D canvas is GPU-rasterised and will never match pixel for
            // pixel across runs. It is asserted structurally instead, below.
            mask: [page.locator('canvas')],
            maskColor: '#ff00ff',
          });
          manifest.push(shot);
        }

        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), 0);
        await page.waitForTimeout(1200);

        styles[key] = await page.evaluate(
          ({ selectors, props }) => {
            const out = {};
            for (const selector of selectors) {
              const nodes = [...document.querySelectorAll(selector)].slice(0, 6);
              out[selector] = nodes.map((node) => {
                const computed = getComputedStyle(node);
                const record = {};
                for (const prop of props) record[prop] = computed.getPropertyValue(prop);
                const box = node.getBoundingClientRect();
                record['#rect'] = [
                  Math.round(box.x), Math.round(box.y),
                  Math.round(box.width), Math.round(box.height),
                ].join(',');
                return record;
              });
            }
            // Structural assertion for the masked 3D canvas.
            const canvas = document.querySelector('canvas');
            out['#webgl'] = canvas
              ? {
                  present: true,
                  width: canvas.width,
                  height: canvas.height,
                  context: !!(
                    canvas.getContext('webgl2') || canvas.getContext('webgl')
                  ),
                }
              : { present: false };
            out['#doc'] = {
              title: document.title,
              scrollHeight: document.documentElement.scrollHeight,
              nodeCount: document.querySelectorAll('*').length,
            };
            return out;
          },
          { selectors: PROBE_SELECTORS, props: PROBE_PROPS }
        );
      } catch (error) {
        styles[key] = { '#error': String(error?.message || error) };
      } finally {
        await page.close();
      }
    }
    await context.close();
  }

  await browser.close();
  await writeFile(join(outDir, 'styles.json'), JSON.stringify(styles, null, 2));
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest.sort(), null, 2));
  return { outDir, shots: manifest.length };
}

if (process.argv[1]?.endsWith('capture.mjs')) {
  const [, , target, baseUrl] = process.argv;
  const result = await capture(target, baseUrl);
  process.stdout.write(`captured ${result.shots} screenshots into ${result.outDir}\n`);
}
