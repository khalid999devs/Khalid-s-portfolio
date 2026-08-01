#!/usr/bin/env node

// Builds dist/sitemap.xml from the live project catalogue so that every case
// study is discoverable. A hand-maintained sitemap silently goes stale the
// moment a project is added, which is the common way portfolio detail pages
// never get crawled at all.
//
// The API is optional on purpose: a build without a reachable catalogue still
// emits a valid sitemap covering the static routes rather than failing the
// release. Set SITEMAP_API_URL to include project URLs.

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { publicRoutes } from '../src/Constants/routes.js';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = resolve(projectDirectory, 'dist');

// Vite only exposes VITE_-prefixed values, and only to browser code. This runs
// as a plain Node build step, so read the same .env directly to keep one source
// of configuration. Values already present in the environment win, which is
// what a CI pipeline or deploy platform expects.
const environmentFile = resolve(projectDirectory, '.env');
if (existsSync(environmentFile)) {
  process.loadEnvFile(environmentFile);
}

const SITE_ORIGIN = (
  process.env.SITE_ORIGIN || 'https://khalidahammed.com'
).replace(/\/+$/, '');
const API_URL = (process.env.SITEMAP_API_URL || '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 10_000;

// Taken from the router's own manifest rather than repeated here. This list
// used to be a second copy that nothing kept in step: a page could be added,
// deployed and linked while staying invisible to search, with no error
// anywhere. Routes marked `sitemap: false` opt out explicitly.
const STATIC_ROUTES = publicRoutes
  .filter((route) => route.sitemap)
  .map(({ path, sitemap }) => ({ path, ...sitemap }));

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const isSafeSlug = (value) =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);

const isSafeId = (value) =>
  Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;

const fetchProjects = async () => {
  if (!API_URL) return [];

  // The catalogue is a POST taking a mode, not a GET. This script predates that
  // change, which is why it had been emitting static routes only.
  const response = await fetch(`${API_URL}/api/projects`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'all' }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`catalogue request failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.succeed !== true || !Array.isArray(payload.result)) {
    throw new Error('catalogue response did not match the expected shape');
  }

  // Reject anything that would produce a malformed or injected URL rather than
  // publishing a sitemap a crawler will reject wholesale.
  return payload.result.filter(
    (project) => isSafeSlug(project?.value) && isSafeId(project?.id)
  );
};

const buildSitemap = (projects) => {
  const entries = [
    ...STATIC_ROUTES.map(({ path, changefreq, priority }) => ({
      loc: `${SITE_ORIGIN}${path}`,
      changefreq,
      priority,
    })),
    ...projects.map((project) => ({
      loc: `${SITE_ORIGIN}/singleProject/${project.value}@${project.id}`,
      changefreq: 'monthly',
      priority: '0.7',
    })),
  ];

  const urls = entries
    .map(
      ({ loc, changefreq, priority }) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>\n` +
        `    <changefreq>${changefreq}</changefreq>\n` +
        `    <priority>${priority}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

let projects = [];
try {
  projects = await fetchProjects();
} catch (error) {
  console.warn(
    `Sitemap: project catalogue unavailable (${error.message}). ` +
      'Emitting static routes only.'
  );
}

writeFileSync(resolve(distDirectory, 'sitemap.xml'), buildSitemap(projects));
console.log(
  `Sitemap written: ${STATIC_ROUTES.length} static route(s), ` +
    `${projects.length} project page(s).`
);
