#!/usr/bin/env node
'use strict';

// Media integrity checker.
//
// Database rows and uploaded bytes live in two different places, so a server
// move, a restore from backup, or a partial copy can leave them disagreeing
// without anything failing loudly: the API keeps returning URLs and visitors
// get broken images. This reports both directions of that disagreement.
//
//   verify   every media path referenced by a project exists and is readable
//   orphans  every file under the uploads root that no project references
//
// `verify` exits non-zero when anything is missing, so a deployment can gate
// on it after restoring a database and its media volume.

require('dotenv').config({ quiet: true });

const { constants } = require('node:fs');
const { access, readdir, stat } = require('node:fs/promises');
const { relative, resolve, sep } = require('node:path');

const {
  UPLOADS_ROOT,
  resolveStoredUploadPath,
} = require('../utils/uploadPaths');
const { closeDatabaseConnection } = require('../utils/serverLifecycle');

const DATABASE_CLOSE_TIMEOUT_MS = 10_000;
const SUPPORTED_COMMANDS = new Set(['verify', 'orphans']);
const MEDIA_LIST_FIELDS = ['videos', 'thumbnailContents', 'sliderContents'];

const parseArguments = (arguments_) => {
  const [command] = arguments_;

  if (!SUPPORTED_COMMANDS.has(command) || arguments_.length !== 1) {
    throw new Error('Usage: node scripts/media.js <verify|orphans>');
  }

  return { command };
};

const parseStoredArray = (value) => {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// One reference per stored path, tagged with where it came from so a failure
// names the exact project and field an operator has to fix.
const collectReferences = (projectRows) => {
  const references = [];

  for (const project of projectRows) {
    const id = project.id;

    if (project.bannerImg) {
      references.push({
        projectId: id,
        field: 'bannerImg',
        storedPath: project.bannerImg,
      });
    }

    for (const field of MEDIA_LIST_FIELDS) {
      parseStoredArray(project[field]).forEach((item, index) => {
        if (item && typeof item === 'object' && item.url) {
          references.push({
            projectId: id,
            field: `${field}[${index}]`,
            storedPath: item.url,
          });
        }
      });
    }
  }

  return references;
};

const checkReference = async (reference) => {
  let resolvedPath;

  try {
    resolvedPath = resolveStoredUploadPath(reference.storedPath);
  } catch (error) {
    return { ...reference, problem: `unsafe path (${error.message})` };
  }

  try {
    const stats = await stat(resolvedPath);
    if (!stats.isFile()) {
      return { ...reference, problem: 'not a regular file' };
    }
    if (stats.size === 0) {
      return { ...reference, problem: 'file is empty' };
    }
    await access(resolvedPath, constants.R_OK);
  } catch (error) {
    return {
      ...reference,
      problem: error.code === 'ENOENT' ? 'missing on disk' : `unreadable (${error.code})`,
    };
  }

  return null;
};

const listFilesRecursively = async (directory) => {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) return listFilesRecursively(entryPath);
      return entry.isFile() ? [entryPath] : [];
    })
  );

  return files.flat();
};

const loadProjects = async (db) =>
  db.projects.findAll({
    attributes: [
      'id',
      'bannerImg',
      'videos',
      'thumbnailContents',
      'sliderContents',
    ],
    raw: true,
  });

const runVerify = async (db, output) => {
  const references = collectReferences(await loadProjects(db));
  const results = await Promise.all(references.map(checkReference));
  const problems = results.filter(Boolean);

  output.write(
    `Checked ${references.length} media reference(s) against ${UPLOADS_ROOT}\n`
  );

  if (!problems.length) {
    output.write('All referenced media is present and readable.\n');
    return { ok: true, checked: references.length, problems };
  }

  output.write(`\n${problems.length} problem(s) found:\n`);
  for (const problem of problems) {
    output.write(
      `  project ${problem.projectId} ${problem.field}: ${problem.problem}\n` +
        `    ${problem.storedPath}\n`
    );
  }
  output.write(
    '\nRestore the missing files into the uploads root, or remove the ' +
      'reference through the administrator interface.\n'
  );

  return { ok: false, checked: references.length, problems };
};

const runOrphans = async (db, output) => {
  const referenced = new Set();

  for (const reference of collectReferences(await loadProjects(db))) {
    try {
      referenced.add(resolveStoredUploadPath(reference.storedPath));
    } catch {
      // An unsafe stored path is reported by `verify`; it cannot claim a file.
    }
  }

  const onDisk = await listFilesRecursively(UPLOADS_ROOT);
  const orphans = onDisk.filter((filePath) => !referenced.has(filePath));

  output.write(
    `Found ${onDisk.length} file(s) under ${UPLOADS_ROOT}; ` +
      `${referenced.size} referenced, ${orphans.length} unreferenced.\n`
  );

  if (orphans.length) {
    output.write('\nUnreferenced files:\n');
    for (const orphan of orphans) {
      output.write(`  uploads${sep}${relative(UPLOADS_ROOT, orphan)}\n`);
    }
    output.write(
      '\nThese are safe to archive once you have confirmed no other ' +
        'environment still points at this uploads root. Nothing is deleted ' +
        'by this command.\n'
    );
  }

  return { ok: true, onDisk: onDisk.length, orphans };
};

const run = async ({
  arguments_ = process.argv.slice(2),
  loadDatabase = () => require('../models'),
  output = process.stdout,
} = {}) => {
  const { command } = parseArguments(arguments_);
  const db = loadDatabase();

  try {
    return command === 'verify'
      ? await runVerify(db, output)
      : await runOrphans(db, output);
  } finally {
    await closeDatabaseConnection(
      db.sequelize,
      DATABASE_CLOSE_TIMEOUT_MS
    ).catch(() => {});
  }
};

if (require.main === module) {
  run()
    .then((result) => {
      if (!result.ok) process.exitCode = 1;
    })
    .catch((error) => {
      process.stderr.write(`Media check failed: ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  collectReferences,
  parseArguments,
  parseStoredArray,
  run,
};
