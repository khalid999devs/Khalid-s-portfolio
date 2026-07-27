'use strict';

/**
 * Two tables that move content and history out of the filesystem and source
 * code, where neither could be queried or edited without a deploy.
 *
 * `DeliveryLogs` replaces `./logs/{succeed,failed}/sent*.txt`. Those files were
 * written relative to the working directory, lived inside the application
 * directory so a deploy discarded them, and held comma separated pseudo-objects
 * that no tool could read back.
 *
 * `AboutEntries` replaces the employment, education and achievement arrays in
 * `client/src/Constants/index.js`. It is seeded here with exactly what those
 * arrays contained, so the About page renders the same before and after.
 */

const { QueryTypes } = require('sequelize');

const tableExists = async (sequelize, table, transaction) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table], type: QueryTypes.SELECT, transaction }
  );
  return Number(rows[0]?.count) > 0;
};

/**
 * Exactly the arrays that were in the client's Constants module, in order.
 * Kept verbatim so the seeded page is byte for byte what shipped before.
 */
const ABOUT_SEED = [
  ['experience', 'Liftoff', 'Remote Full Stack Software Engineer', 'Jul 2025 — Jun 2026', 'https://www.linkedin.com/company/liftoffapp/posts/?feedView=all'],
  ['experience', 'Scraft Studio', 'Remote Full Stack Developer', 'Apr 2025  —  Jul 2025', 'https://in.linkedin.com/company/scraftstudio'],
  ['experience', 'DevGenit', 'Chief Operating Officer (Self-employed)', 'Oct 2023  —  Jan 2026', 'https://www.devgenit.com'],
  ['experience', 'Notre Dame Information Technology Club', 'President, Department of Web & App Development', 'Sep 2022  —  April 2023', 'https://nditc.net'],

  ['achievement', 'Regional Winner and Global Nominee', 'NASA SPACE APP CHALLANGE HACKATHON 2024', '2024', 'https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/novaflare/?tab=details'],
  ['achievement', 'Champion in national Web Design Contest', 'Notre Dame Science Club', '2022', 'https://www.facebook.com/photo/?fbid=5025775960821528&set=pcb.1113307382606258'],

  ['education', 'Computer Science and Engineering', 'Khulna University of Engineering & Technology, Bangladesh.', '2023 — 2027', null],
  ['education', 'Higher Secondary School Certificate ', 'Notre Dame College, Dhaka, Bangladesh', '2020 — 2022', null],
];

module.exports.up = async ({ sequelize, transaction }) => {
  if (!(await tableExists(sequelize, 'DeliveryLogs', transaction))) {
    await sequelize.query(
      `CREATE TABLE DeliveryLogs (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        channel ENUM('email','sms') NOT NULL,
        mode VARCHAR(64) NULL,
        recipient VARCHAR(255) NULL,
        subject VARCHAR(255) NULL,
        status ENUM('succeeded','failed') NOT NULL,
        providerCode VARCHAR(32) NULL,
        detail VARCHAR(512) NULL,
        durationMs INT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX delivery_logs_status_idx (status),
        INDEX delivery_logs_channel_idx (channel),
        INDEX delivery_logs_created_at_idx (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      { transaction }
    );
  }

  if (!(await tableExists(sequelize, 'AboutEntries', transaction))) {
    await sequelize.query(
      `CREATE TABLE AboutEntries (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        section ENUM('experience','education','achievement') NOT NULL,
        title VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255) NULL,
        period VARCHAR(128) NULL,
        link VARCHAR(512) NULL,
        displayOrder INT NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX about_entries_section_order_idx (section, displayOrder)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      { transaction }
    );
  }

  // Seed only when empty, so re-running never duplicates rows or overwrites
  // edits made through the panel.
  const [{ count }] = await sequelize.query(
    'SELECT COUNT(*) AS count FROM AboutEntries',
    { type: QueryTypes.SELECT, transaction }
  );

  if (Number(count) === 0) {
    const perSection = {};
    for (const [section, title, subtitle, period, link] of ABOUT_SEED) {
      perSection[section] = (perSection[section] ?? -1) + 1;
      await sequelize.query(
        `INSERT INTO AboutEntries
           (section, title, subtitle, period, link, displayOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        {
          replacements: [section, title, subtitle, period, link, perSection[section]],
          transaction,
        }
      );
    }
  }
};
