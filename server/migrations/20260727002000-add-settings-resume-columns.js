'use strict';

/**
 * Gives the resume a home in the database.
 *
 * It used to be a filename hardcoded in the download controller, resolved
 * against the application directory. That is wrong in two ways: the file cannot
 * be replaced without shell access, and the path ignores UPLOADS_ROOT, so once
 * UPLOADS_DIR points at a mounted volume -- which DEPLOYMENT.md requires,
 * because otherwise a deploy wipes the uploads -- the static mount and the
 * download endpoint read from two different places.
 *
 * Additive and idempotent: existing rows get NULL, which the controller reports
 * as "no resume uploaded" rather than failing. Nothing needs backfilling; the
 * first upload through the admin panel populates it.
 */

const { QueryTypes } = require('sequelize');
const { existsSync } = require('fs');
const { join } = require('path');
const { UPLOADS_ROOT } = require('../utils/uploadPaths');

/**
 * The filename the old hardcoded controller served. If it is still on disk,
 * the new columns adopt it so the site keeps working the moment this migration
 * runs -- otherwise the resume button would disappear from the live site until
 * someone happened to log in and re-upload the same document.
 */
const LEGACY_RESUME_NAME = 'Resume_Khalid_Ahammed.pdf';
const LEGACY_STORED_PATH = `uploads/assets/${LEGACY_RESUME_NAME}`;

const columnExists = async (sequelize, table, column, transaction) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column], type: QueryTypes.SELECT, transaction }
  );
  return Number(rows[0]?.count) > 0;
};

module.exports.up = async ({ sequelize, transaction }) => {
  if (!(await columnExists(sequelize, 'settings', 'resume', transaction))) {
    await sequelize.query(
      'ALTER TABLE settings ADD COLUMN resume VARCHAR(512) NULL DEFAULT NULL',
      { transaction }
    );
  }

  if (
    !(await columnExists(sequelize, 'settings', 'resumeOriginalName', transaction))
  ) {
    await sequelize.query(
      'ALTER TABLE settings ADD COLUMN resumeOriginalName VARCHAR(255) NULL DEFAULT NULL',
      { transaction }
    );
  }

  // Adopt the file the old controller served, if it is where it used to be.
  // Only fills rows that have no resume yet, so re-running this never clobbers
  // a document uploaded through the admin panel.
  if (existsSync(join(UPLOADS_ROOT, 'assets', LEGACY_RESUME_NAME))) {
    await sequelize.query(
      'UPDATE settings SET resume = ?, resumeOriginalName = ? WHERE resume IS NULL',
      { replacements: [LEGACY_STORED_PATH, LEGACY_RESUME_NAME], transaction }
    );
  }
};
