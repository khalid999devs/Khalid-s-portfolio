const { verify } = require('jsonwebtoken');
const { Admin } = require('../models');
const { UnauthenticatedError } = require('../errors');
const {
  ADMIN_COOKIE_NAME,
  getAdminTokenVerificationOptions,
  requireAdminSecret,
} = require('../utils/createToken');

const adminValidate = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = req.signedCookies?.[ADMIN_COOKIE_NAME];

  if (!token) {
    throw new UnauthenticatedError('Admin authentication required');
  }

  let validAdmin;
  try {
    validAdmin = verify(
      token,
      requireAdminSecret(),
      getAdminTokenVerificationOptions()
    );
  } catch (_error) {
    throw new UnauthenticatedError('Invalid or expired admin session');
  }

  if (
    validAdmin.role !== 'admin' ||
    !Number.isInteger(validAdmin.id) ||
    !Number.isSafeInteger(validAdmin.sessionVersion) ||
    validAdmin.sessionVersion < 0 ||
    validAdmin.sub !== String(validAdmin.id)
  ) {
    throw new UnauthenticatedError('Invalid or expired admin session');
  }

  const existingAdmin = await Admin.findByPk(validAdmin.id, {
    attributes: ['id', 'sessionVersion', 'userName'],
  });

  if (
    !existingAdmin ||
    existingAdmin.userName !== validAdmin.userName ||
    existingAdmin.sessionVersion !== validAdmin.sessionVersion
  ) {
    throw new UnauthenticatedError('Invalid or expired admin session');
  }

  req.admin = {
    id: existingAdmin.id,
    role: 'admin',
    userName: existingAdmin.userName,
  };
  next();
};

module.exports = adminValidate;
