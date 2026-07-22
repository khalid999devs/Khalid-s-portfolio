'use strict';

const { hash } = require('bcryptjs');
const { Transaction } = require('sequelize');

const DEFAULT_BCRYPT_COST = 12;
const MINIMUM_BCRYPT_COST = 10;
const MAXIMUM_BCRYPT_COST = 14;
const MINIMUM_PASSWORD_LENGTH = 16;
const MAXIMUM_PASSWORD_BYTES = 72;
const MAXIMUM_USERNAME_LENGTH = 255;
const MAXIMUM_SESSION_VERSION = 2_147_483_647;

const normalizeAdminUserName = (value) => {
  if (typeof value !== 'string') {
    throw new Error('ADMIN_USERNAME is required');
  }

  const userName = value.trim();
  if (
    !userName ||
    [...userName].length > MAXIMUM_USERNAME_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(userName)
  ) {
    throw new Error(
      `ADMIN_USERNAME must contain 1-${MAXIMUM_USERNAME_LENGTH} visible characters`
    );
  }

  return userName;
};

const validateAdminPassword = (password) => {
  if (
    typeof password !== 'string' ||
    [...password].length < MINIMUM_PASSWORD_LENGTH ||
    !password.trim() ||
    /[\r\n\u0000]/u.test(password)
  ) {
    throw new Error(
      `Administrator password must contain at least ${MINIMUM_PASSWORD_LENGTH} characters`
    );
  }

  if (Buffer.byteLength(password, 'utf8') > MAXIMUM_PASSWORD_BYTES) {
    throw new Error(
      `Administrator password must not exceed ${MAXIMUM_PASSWORD_BYTES} UTF-8 bytes`
    );
  }

  return password;
};

const parseBcryptCost = (value) => {
  if (value === undefined || String(value).trim() === '') {
    return DEFAULT_BCRYPT_COST;
  }

  const normalizedValue = String(value).trim();
  if (!/^\d+$/u.test(normalizedValue)) {
    throw new Error(
      `ADMIN_PASSWORD_BCRYPT_COST must be between ${MINIMUM_BCRYPT_COST} and ${MAXIMUM_BCRYPT_COST}`
    );
  }

  const cost = Number(normalizedValue);
  if (cost < MINIMUM_BCRYPT_COST || cost > MAXIMUM_BCRYPT_COST) {
    throw new Error(
      `ADMIN_PASSWORD_BCRYPT_COST must be between ${MINIMUM_BCRYPT_COST} and ${MAXIMUM_BCRYPT_COST}`
    );
  }

  return cost;
};

const transactionOptions = {
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
};

const bootstrapAdmin = async ({
  Admin,
  bcryptCost = DEFAULT_BCRYPT_COST,
  password,
  sequelize,
  userName,
}) => {
  const normalizedUserName = normalizeAdminUserName(userName);
  const validatedPassword = validateAdminPassword(password);
  const validatedCost = parseBcryptCost(bcryptCost);
  const passwordHash = await hash(validatedPassword, validatedCost);

  return sequelize.transaction(transactionOptions, async (transaction) => {
    const existingAdmin = await Admin.findOne({
      attributes: ['id'],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (existingAdmin) {
      throw new Error(
        'Administrator bootstrap is locked because an account already exists; use npm run admin:rotate'
      );
    }

    return Admin.create(
      {
        password: passwordHash,
        // Version 1 marks credentials provisioned by the hardened account tool.
        // Migrated legacy rows start at 0 and must be explicitly rotated.
        sessionVersion: 1,
        userName: normalizedUserName,
      },
      { transaction }
    );
  });
};

const rotateAdminPassword = async ({
  Admin,
  bcryptCost = DEFAULT_BCRYPT_COST,
  password,
  sequelize,
  userName,
}) => {
  const normalizedUserName = normalizeAdminUserName(userName);
  const validatedPassword = validateAdminPassword(password);
  const validatedCost = parseBcryptCost(bcryptCost);
  const passwordHash = await hash(validatedPassword, validatedCost);

  return sequelize.transaction(transactionOptions, async (transaction) => {
    const admin = await Admin.findOne({
      attributes: ['id', 'sessionVersion', 'userName'],
      lock: transaction.LOCK.UPDATE,
      transaction,
      where: { userName: normalizedUserName },
    });

    if (!admin) {
      throw new Error('No administrator account matches ADMIN_USERNAME');
    }

    const sessionVersion = Number(admin.sessionVersion);
    if (
      !Number.isSafeInteger(sessionVersion) ||
      sessionVersion < 0 ||
      sessionVersion >= MAXIMUM_SESSION_VERSION
    ) {
      throw new Error('Administrator account has an invalid session version');
    }

    await admin.update(
      {
        password: passwordHash,
        sessionVersion: sessionVersion + 1,
      },
      { transaction }
    );

    return admin;
  });
};

module.exports = {
  DEFAULT_BCRYPT_COST,
  MAXIMUM_PASSWORD_BYTES,
  MINIMUM_PASSWORD_LENGTH,
  bootstrapAdmin,
  normalizeAdminUserName,
  parseBcryptCost,
  rotateAdminPassword,
  validateAdminPassword,
};
