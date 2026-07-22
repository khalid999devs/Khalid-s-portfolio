const { compare } = require('bcryptjs');
const { Admin } = require('../models');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const {
  attachTokenToResponse,
  clearTokenFromResponse,
  createAdminJWT,
} = require('../utils/createToken');

// Comparing against a real hash for unknown usernames reduces account-enumeration
// timing differences without exposing or depending on an actual administrator.
const DUMMY_PASSWORD_HASH =
  '$2a$10$AAQpITaxTvaZkVLTpq0hGu1Yd8i5rAtmbd7ZB6yxMakm1NaxcT6wS';

const getAllAdmins = async (req, res) => {
  const result = await Admin.findAll({ attributes: ['id', 'userName'] });
  res.json({ succeed: true, result: result });
};

const adminLogin = async (req, res) => {
  const { userName, password } = req.body;

  if (
    typeof userName !== 'string' ||
    typeof password !== 'string' ||
    !userName.trim() ||
    !password ||
    userName.length > 255 ||
    password.length > 1024
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
