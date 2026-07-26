#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = resolve(projectDirectory, 'dist');
const assetsDirectory = resolve(distDirectory, 'assets');

const limits = Object.freeze({
  criticalCssGzip: 12 * 1024,
  criticalJavaScriptGzip: 235 * 1024,
  portraitImage: 40 * 1024,
  projectPlaceholder: 45 * 1024,
  robotFallback: 25 * 1024,
  sceneJavaScriptGzip: 160 * 1024,
  scenePayload: 1_680_000,
});

if (!existsSync(assetsDirectory)) {
  throw new Error(
    'Production assets are missing. Run `npm run build` before checking budgets.'
  );
}

const assetNames = readdirSync(assetsDirectory);

const findSingleAsset = (pattern, label) => {
  const matches = assetNames.filter((name) => pattern.test(name));
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${label} asset, found ${matches.length}: ${matches.join(', ')}`
    );
  }
  return matches[0];
};

const entryChunk = findSingleAsset(/^index-[\w-]+\.js$/u, 'entry JavaScript');
const appChunk = findSingleAsset(/^App-[\w-]+\.js$/u, 'App JavaScript');
const homeChunk = findSingleAsset(/^Home-[\w-]+\.js$/u, 'Home JavaScript');
const sceneChunk = findSingleAsset(/^Scene-[\w-]+\.js$/u, 'Scene JavaScript');
const styleAsset = findSingleAsset(/^index-[\w-]+\.css$/u, 'critical CSS');

const readAsset = (name) => readFileSync(resolve(assetsDirectory, name));
const gzipSize = (buffer) => gzipSync(buffer, { level: 9 }).byteLength;
const staticImportPattern =
  /(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/gu;

const criticalChunks = new Set();
const collectStaticImports = (chunkName) => {
  if (criticalChunks.has(chunkName)) return;
  criticalChunks.add(chunkName);

  const source = readAsset(chunkName).toString('utf8');
  for (const match of source.matchAll(staticImportPattern)) {
    collectStaticImports(match[1]);
  }
};

[entryChunk, appChunk, homeChunk].forEach(collectStaticImports);

const criticalJavaScriptGzip = [...criticalChunks].reduce(
  (total, chunkName) => total + gzipSize(readAsset(chunkName)),
  0
);
const criticalCssGzip = gzipSize(readAsset(styleAsset));
const sceneJavaScriptGzip = gzipSize(readAsset(sceneChunk));
const sceneModelPath = resolve(distDirectory, 'scene.glb');
const robotFallbackPath = resolve(
  distDirectory,
  'Images',
  'Hero',
  'robot.png'
);
const portraitImagePath = resolve(
  distDirectory,
  'Images',
  'About',
  'myPic.webp'
);
const projectPlaceholderPath = resolve(
  distDirectory,
  'Images',
  'project-placeholder.webp'
);

if (
  !existsSync(sceneModelPath) ||
  !existsSync(robotFallbackPath) ||
  !existsSync(portraitImagePath) ||
  !existsSync(projectPlaceholderPath)
) {
  throw new Error('A budgeted static asset is missing.');
}

const sceneModelBytes = readFileSync(sceneModelPath).byteLength;
const robotFallbackBytes = readFileSync(robotFallbackPath).byteLength;
const portraitImageBytes = readFileSync(portraitImagePath).byteLength;
const projectPlaceholderBytes =
  readFileSync(projectPlaceholderPath).byteLength;
const scenePayload = sceneJavaScriptGzip + sceneModelBytes;

const measurements = [
  {
    label: 'critical JavaScript (gzip)',
    limit: limits.criticalJavaScriptGzip,
    value: criticalJavaScriptGzip,
  },
  {
    label: 'critical CSS (gzip)',
    limit: limits.criticalCssGzip,
    value: criticalCssGzip,
  },
  {
    label: 'deferred Scene JavaScript (gzip)',
    limit: limits.sceneJavaScriptGzip,
    value: sceneJavaScriptGzip,
  },
  {
    label: 'deferred Scene JavaScript + GLB',
    limit: limits.scenePayload,
    value: scenePayload,
  },
  {
    label: 'static robot fallback',
    limit: limits.robotFallback,
    value: robotFallbackBytes,
  },
  {
    label: 'portrait image',
    limit: limits.portraitImage,
    value: portraitImageBytes,
  },
  {
    label: 'project placeholder',
    limit: limits.projectPlaceholder,
    value: projectPlaceholderBytes,
  },
];

const failures = measurements.filter(({ limit, value }) => value > limit);
const formatBytes = (value) => `${(value / 1024).toFixed(1)} KiB`;

if (failures.length > 0) {
  failures.forEach(({ label, limit, value }) => {
    process.stderr.write(
      `${label} exceeds its budget: ${formatBytes(value)} > ${formatBytes(
        limit
      )}\n`
    );
  });
  process.exit(1);
}

process.stdout.write(
  `Bundle budgets passed: ${measurements
    .map(
      ({ label, limit, value }) =>
        `${label} ${formatBytes(value)}/${formatBytes(limit)}`
    )
    .join(', ')}.\n`
);
