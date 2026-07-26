const { compare, hashSync } = require('bcryptjs');
const { Admin } = require('../models');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const {
  attachTokenToResponse,
  clearTokenFromResponse,
  createAdminJWT,
} = require('../utils/createToken');
const {
  DEFAULT_BCRYPT_COST,
  parseBcryptCost,
} = require('../utils/adminAccount');

// Comparing against a real hash for unknown usernames reduces account-enumeration
// timing differences without exposing or depending on an actual administrator.
const DUMMY_PASSWORD_HASH = hashSync(
  'not-a-valid-administrator-password',
  parseBcryptCost(
    process.env.ADMIN_PASSWORD_BCRYPT_COST || DEFAULT_BCRYPT_COST
  )
);

const getAllAdmins = async (req, res) => {
  const result = await Admin.findAll({ attributes: ['id', 'userName'] });
  res.json({ succeed: true, result: result });
};

const adminLogin = async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('Username and password are required');
  }

  const { userName, password } = body;

  if (
    typeof userName !== 'string' ||
    typeof password !== 'string' ||
    !userName.trim() ||
    !password ||
    userName.length > 255 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new BadRequestError('Username and password are required');
  }

  const normalizedUserName = userName.trim();
  const admin = await Admin.findOne({
    where: { userName: normalizedUserName },
  });
  const passwordMatches = await compare(
    password,
    admin?.password || DUMMY_PASSWORD_HASH
  );

  if (!admin || !passwordMatches) {
    throw new UnauthenticatedError('Invalid username or password');
  }

  const token = createAdminJWT({
    id: admin.id,
    sessionVersion: admin.sessionVersion,
    userName: admin.userName,
  });
  attachTokenToResponse({ res, token });
  res.json({ succeed: true, msg: 'successfully logged in' });
};

const adminLogout = (req, res) => {
  clearTokenFromResponse(res);
  res.json({ succeed: true, msg: 'successfully logged out' });
};

const isAdminValidated = (req, res) => {
  res.json({ succeed: true, result: req.admin });
};

module.exports = {
  getAllAdmins,
  adminLogin,
  isAdminValidated,
  adminLogout,
};
