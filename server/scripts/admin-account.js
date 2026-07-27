#!/usr/bin/env node
'use strict';

/**
 * Creates and rotates the single administrator account.
 *
 * This replaces `POST /api/admin/reg`, which was unauthenticated: anyone could
 * register a username and receive a full administrator session, which unlocked
 * every write route on the server. Account creation now requires shell access
 * to the machine that can reach the database.
 *
 *   npm run admin:bootstrap    create the administrator (refuses if one exists)
 *   npm run admin:rotate       change an existing administrator's password
 *
 * Passwords are read from a hidden prompt and confirmed. They are never accepted
 * as command-line arguments, because argv is visible in `ps` output and lands in
 * shell history.
 */

require('dotenv').config();

const { compare, hash } = require('bcryptjs');
const db = require('../models');
const { Admin } = db;

const MINIMUM_PASSWORD_LENGTH = 16;
const DEFAULT_BCRYPT_COST = 12;

const usage = () => {
  process.stderr.write(
    'Usage: node scripts/admin-account.js <bootstrap|rotate>\n' +
      'Passwords are prompted for, never passed as arguments.\n'
  );
  process.exit(2);
};

const parseCost = () => {
  const raw = process.env.SALT ?? process.env.ADMIN_PASSWORD_BCRYPT_COST;
  const cost = Number(raw);
  if (!Number.isInteger(cost) || cost < 10 || cost > 15) {
    return DEFAULT_BCRYPT_COST;
  }
  return cost;
};

/** Reads a line from the TTY without echoing it. */
const readHidden = (prompt) =>
  new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY) {
      reject(new Error('A terminal is required so the password is not echoed.'));
      return;
    }

    output.write(prompt);
    let value = '';
    const previousRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(Boolean(previousRaw));
      input.pause();
      output.write('\n');
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Cancelled.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        // Ignore other control characters rather than storing them.
        if (char >= ' ') value += char;
        if (value.length > 512) {
          cleanup();
          reject(new Error('Password is implausibly long; aborting.'));
          return;
        }
      }
    };

    input.on('data', onData);
  });

const readVisible = (prompt) =>
  new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (chunk) => {
      process.stdin.pause();
      resolve(String(chunk).trim());
    });
  });

const assertUsableUserName = (userName) => {
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(userName)) {
    throw new Error(
      'Username must be 3-64 characters of letters, digits, dot, underscore or hyphen.'
    );
  }
};

const assertUsablePassword = (password) => {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  }
  if (/^\s|\s$/.test(password)) {
    throw new Error('Password must not start or end with whitespace.');
  }
};

const promptForNewPassword = async () => {
  const password = await readHidden('New password: ');
  assertUsablePassword(password);
  const confirmation = await readHidden('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords did not match.');
  return password;
};

const bootstrap = async () => {
  const existing = await Admin.count();
  if (existing > 0) {
    throw new Error(
      `${existing} administrator account(s) already exist. Use "rotate" to change a password.`
    );
  }

  const userName = await readVisible('Administrator username: ');
  assertUsableUserName(userName);
  const password = await promptForNewPassword();

  await Admin.create({ userName, password: await hash(password, parseCost()) });
  process.stdout.write(`Created administrator "${userName}".\n`);
};

const rotate = async () => {
  const userName = await readVisible('Administrator username: ');
  const admin = await Admin.findOne({ where: { userName } });
  if (!admin) throw new Error('No administrator with that username.');

  const current = await readHidden('Current password: ');
  if (!(await compare(current, admin.password))) {
    throw new Error('Current password is incorrect.');
  }

  const password = await promptForNewPassword();
  if (await compare(password, admin.password)) {
    throw new Error('New password must differ from the current one.');
  }

  admin.password = await hash(password, parseCost());
  await admin.save();
  process.stdout.write(
    `Rotated the password for "${userName}". Existing sessions remain valid until their tokens expire.\n`
  );
};

const main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  if (rest.length > 0 || !['bootstrap', 'rotate'].includes(command)) usage();

  await db.sequelize.authenticate();
  if (command === 'bootstrap') await bootstrap();
  else await rotate();
};

main()
  .then(async () => {
    await db.sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    process.stderr.write(`${error.message}\n`);
    await db.sequelize.close().catch(() => {});
    process.exit(1);
  });
