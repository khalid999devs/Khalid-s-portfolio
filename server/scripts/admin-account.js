#!/usr/bin/env node
'use strict';

require('dotenv').config({ quiet: true });

const { timingSafeEqual } = require('node:crypto');
const {
  bootstrapAdmin,
  normalizeAdminUserName,
  parseBcryptCost,
  rotateAdminPassword,
} = require('../utils/adminAccount');
const { assertDatabaseReady } = require('../utils/databaseReadiness');

const MAXIMUM_STDIN_BYTES = 1024;
const SUPPORTED_COMMANDS = new Set(['bootstrap', 'rotate']);

const parseCommand = (arguments_) => {
  if (
    arguments_.length !== 1 ||
    !SUPPORTED_COMMANDS.has(arguments_[0])
  ) {
    throw new Error(
      'Usage: npm run admin:bootstrap or npm run admin:rotate; passwords are never accepted as arguments'
    );
  }

  return arguments_[0];
};

const secretsMatch = (first, second) => {
  const firstBuffer = Buffer.from(first, 'utf8');
  const secondBuffer = Buffer.from(second, 'utf8');
  if (firstBuffer.length !== secondBuffer.length) return false;
  return timingSafeEqual(firstBuffer, secondBuffer);
};

const readHiddenLine = ({ input, output, prompt }) =>
  new Promise((resolve, reject) => {
    let value = '';
    const previousRawMode = input.isRaw;

    const cleanup = () => {
      input.off('data', onData);
      if (input.isTTY && typeof input.setRawMode === 'function') {
        input.setRawMode(Boolean(previousRawMode));
      }
      input.pause();
    };

    const finish = () => {
      cleanup();
      output.write('\n');
      resolve(value);
    };

    const fail = (error) => {
      cleanup();
      output.write('\n');
      reject(error);
    };

    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === '\u0003') {
          fail(new Error('Administrator credential operation cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
          continue;
        }
        if (character >= ' ') value += character;
      }
    };

    output.write(prompt);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });

const readStandardInputSecret = async (input) => {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of input) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAXIMUM_STDIN_BYTES) {
      throw new Error('Administrator password input is too large');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/u, '');
};

const readPassword = async ({ input, output }) => {
  if (!input.isTTY || !output.isTTY) {
    return readStandardInputSecret(input);
  }

  const password = await readHiddenLine({
    input,
    output,
    prompt: 'New administrator password: ',
  });
  const confirmation = await readHiddenLine({
    input,
    output,
    prompt: 'Confirm administrator password: ',
  });

  if (!secretsMatch(password, confirmation)) {
    throw new Error('Administrator password confirmation does not match');
  }

  return password;
};

const run = async ({
  arguments_ = process.argv.slice(2),
  env = process.env,
  input = process.stdin,
  loadDatabase = () => require('../models'),
  output = process.stdout,
} = {}) => {
  const command = parseCommand(arguments_);
  const userName = normalizeAdminUserName(env.ADMIN_USERNAME);
  const bcryptCost = parseBcryptCost(env.ADMIN_PASSWORD_BCRYPT_COST);
  const db = loadDatabase();

  try {
    await assertDatabaseReady(db.sequelize);
    const password = await readPassword({ input, output });
    const operation =
      command === 'bootstrap' ? bootstrapAdmin : rotateAdminPassword;

    await operation({
      Admin: db.Admin,
      bcryptCost,
      password,
      sequelize: db.sequelize,
      userName,
    });

    output.write(
      command === 'bootstrap'
        ? 'Administrator account created successfully.\n'
        : 'Administrator password rotated; prior sessions are now invalid.\n'
    );
  } finally {
    await db.sequelize.close();
  }
};

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`Administrator account operation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  MAXIMUM_STDIN_BYTES,
  parseCommand,
  readPassword,
  readStandardInputSecret,
  run,
  secretsMatch,
};
