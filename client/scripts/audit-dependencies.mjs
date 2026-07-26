#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(resolve(projectDirectory, 'package.json'), 'utf8')
);
const acceptedAdvisories = new Map([
  [
    'https://github.com/advisories/GHSA-qwww-vcr4-c8h2',
    {
      expiresAt: '2026-12-31T23:59:59.999Z',
      packages: new Set(['react-router', 'react-router-dom']),
      reason:
        'The advisory affects React Router Framework RSC action handling. ' +
        'This repository is a Vite SPA and has no React Router Framework/RSC runtime.',
    },
  ],
]);

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const audit = spawnSync(npmExecutable, ['audit', '--json'], {
  cwd: projectDirectory,
  encoding: 'utf8',
  env: process.env,
});

let report;
try {
  report = JSON.parse(audit.stdout || '');
} catch {
  process.stderr.write(audit.stderr || audit.stdout || 'npm audit failed.\n');
  process.exit(1);
}

if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
  process.stderr.write(
    `npm audit did not return a vulnerability report.${
      report.error?.summary ? ` ${report.error.summary}` : ''
    }\n`
  );
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities;
const collectAdvisories = (packageName, visited = new Set()) => {
  if (visited.has(packageName)) return { advisories: [], unresolved: [] };
  visited.add(packageName);

  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) {
    return { advisories: [], unresolved: [packageName] };
  }

  const advisories = [];
  const unresolved = [];
  for (const cause of vulnerability.via || []) {
    if (typeof cause === 'string') {
      const nested = collectAdvisories(cause, visited);
      advisories.push(...nested.advisories);
      unresolved.push(...nested.unresolved);
    } else if (cause?.url) {
      advisories.push(cause.url);
    } else {
      unresolved.push(packageName);
    }
  }
  return { advisories, unresolved };
};

const dependencyNames = new Set([
  ...Object.keys(manifest.dependencies || {}),
  ...Object.keys(manifest.devDependencies || {}),
]);
const forbiddenFrameworkPackages = [
  '@react-router/dev',
  '@react-router/fs-routes',
  '@react-router/node',
  '@react-router/serve',
];
const hasFrameworkRuntime =
  forbiddenFrameworkPackages.some((name) => dependencyNames.has(name)) ||
  Object.values(manifest.scripts || {}).some((script) =>
    /\breact-router\b/u.test(script)
  ) ||
  [
    'react-router.config.js',
    'react-router.config.mjs',
    'react-router.config.ts',
  ].some((name) => existsSync(resolve(projectDirectory, name)));

const unaccepted = [];
const accepted = [];
for (const packageName of Object.keys(vulnerabilities)) {
  const { advisories, unresolved } = collectAdvisories(packageName);
  const uniqueAdvisories = [...new Set(advisories)];
  const acceptanceRecords = uniqueAdvisories.map((url) =>
    acceptedAdvisories.get(url)
  );
  const isAccepted =
    uniqueAdvisories.length > 0 &&
    unresolved.length === 0 &&
    acceptanceRecords.every(Boolean) &&
    acceptanceRecords.every(
      ({ expiresAt, packages }) =>
        Date.now() <= Date.parse(expiresAt) && packages.has(packageName)
    ) &&
    !hasFrameworkRuntime;

  if (isAccepted) {
    accepted.push({ packageName, advisories: uniqueAdvisories });
  } else {
    unaccepted.push({
      packageName,
      advisories: uniqueAdvisories,
      unresolved,
    });
  }
}

if (unaccepted.length > 0) {
  process.stderr.write(
    `Unaccepted dependency vulnerabilities:\n${JSON.stringify(
      unaccepted,
      null,
      2
    )}\n`
  );
  process.exit(1);
}

if (accepted.length > 0) {
  const advisoryUrls = [
    ...new Set(accepted.flatMap(({ advisories }) => advisories)),
  ];
  advisoryUrls.forEach((url) => {
    const record = acceptedAdvisories.get(url);
    process.stdout.write(
      `Temporarily accepted ${url} through ${record.expiresAt}: ${record.reason}\n`
    );
  });
} else {
  process.stdout.write('No dependency vulnerabilities found.\n');
}
