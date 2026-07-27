#!/usr/bin/env node
'use strict';

/**
 * Loads a local development database and uploads directory from the recorded
 * production snapshot in `verification/fixtures/`.
 *
 * The local database otherwise holds placeholder rows and no settings at all,
 * which leaves most of the site unrendered -- the skills grid, the project
 * catalogue and every image. Running this makes a local checkout look like the
 * live site so changes can actually be judged.
 *
 *   npm run seed:local
 *
 * Existing rows are written to a timestamped backup file first; nothing is
 * discarded silently. Refuses to run against a production database.
 */

require('dotenv').config({ quiet: true });

const { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, writeFileSync } = require('fs');
const { join, dirname, relative } = require('path');
const db = require('../models');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');

const FIXTURES = join(__dirname, '..', '..', 'verification', 'fixtures');
const API_DIR = join(FIXTURES, 'api');
const MEDIA_DIR = join(FIXTURES, 'media');

if (process.env.NODE_ENV === 'production') {
  process.stderr.write(
    'Refusing to run against production. This replaces the projects and settings tables.\n'
  );
  process.exit(2);
}

const readFixture = (name) => require(join(API_DIR, name));

/** Recursively copies the fixture media tree into the uploads root. */
const copyMedia = (from, to) => {
  let copied = 0;
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const target = join(to, entry);
    if (statSync(source).isDirectory()) {
      mkdirSync(target, { recursive: true });
      copied += copyMedia(source, target);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
      copied += 1;
    }
  }
  return copied;
};

/**
 * The API returns arrays already parsed; the columns are TEXT holding JSON.
 * Re-encode so the stored shape matches what the write paths produce.
 */
const JSON_COLUMNS = ['role', 'techStack', 'videos', 'thumbnailContents', 'sliderContents'];

const toRow = (project) => {
  const row = { ...project };
  for (const column of JSON_COLUMNS) {
    row[column] = JSON.stringify(row[column] ?? []);
  }
  return row;
};

const main = async () => {
  await db.sequelize.authenticate();

  // --- back up whatever is there now -------------------------------------
  const existingProjects = await db.projects.findAll({ raw: true });
  const existingSettings = await db.settings.findAll({ raw: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(__dirname, '..', `local-db-backup-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify({ projects: existingProjects, settings: existingSettings }, null, 2)
  );
  process.stdout.write(
    `backed up ${existingProjects.length} project(s) and ${existingSettings.length} settings row(s)\n` +
      `  -> ${relative(process.cwd(), backupPath)}\n\n`
  );

  // --- media --------------------------------------------------------------
  if (!existsSync(MEDIA_DIR)) {
    throw new Error(`No fixture media at ${MEDIA_DIR}.`);
  }
  // Fixture paths already begin with `uploads/`, and UPLOADS_ROOT *is* that
  // directory, so copy the tree below it rather than the prefix itself.
  const copied = copyMedia(join(MEDIA_DIR, 'uploads'), UPLOADS_ROOT);
  process.stdout.write(`copied ${copied} media file(s) into ${UPLOADS_ROOT}\n\n`);

  // --- data ---------------------------------------------------------------
  const projects = readFixture('projects.json').result.map((summary) =>
    toRow(readFixture(`project-${summary.id}.json`).result)
  );
  const settings = readFixture('settings.json').result;

  await db.sequelize.transaction(async (transaction) => {
    await db.projects.destroy({ where: {}, truncate: false, transaction });
    await db.projects.bulkCreate(projects, { transaction });

    await db.settings.destroy({ where: {}, truncate: false, transaction });
    await db.settings.create(
      {
        id: settings.id,
        technologies: JSON.stringify(settings.technologies),
      },
      { transaction }
    );
  });

  process.stdout.write(`seeded ${projects.length} project(s):\n`);
  for (const project of projects) {
    process.stdout.write(`  ${project.id}  ${project.title}  (/singleProject/${project.value})\n`);
  }
  process.stdout.write(
    `seeded settings with ${Object.keys(settings.technologies).length} technology group(s)\n`
  );

  // --- prove the two halves agree -----------------------------------------
  const { resolveStoredUploadPath } = require('../utils/uploadPaths');
  const referenced = [];
  const collect = (value) => {
    if (typeof value === 'string' && value.startsWith('uploads/')) referenced.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(projects.map((p) => JSON_COLUMNS.reduce((acc, c) => ({ ...acc, [c]: JSON.parse(p[c]) }), p)));

  const missing = [...new Set(referenced)].filter((stored) => {
    const resolved = resolveStoredUploadPath(stored);
    return !resolved || !existsSync(resolved);
  });

  process.stdout.write(
    `\nmedia check: ${new Set(referenced).size} referenced, ${missing.length} missing\n`
  );
  for (const path of missing) process.stdout.write(`  MISSING ${path}\n`);
  if (missing.length > 0) throw new Error('Some referenced media is not on disk.');
};

main()
  .then(async () => {
    await db.sequelize.close();
    process.stdout.write('\nDone. Start the server and the client to view it locally.\n');
    process.exit(0);
  })
  .catch(async (error) => {
    process.stderr.write(`\nSeed failed: ${error.message}\n`);
    await db.sequelize.close().catch(() => {});
    process.exit(1);
  });
