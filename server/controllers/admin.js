const { compare } = require('bcryptjs');
const { Admin } = require('../models');
const { sign } = require('jsonwebtoken');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const {
  attachTokenToResponse,
  clearTokenCookie,
} = require('../utils/createToken');
const env = require('../config/env');

// A bcrypt hash of a value no password can produce. Compared against when the
// username is unknown so the failure path costs the same as a real one.
const ABSENT_ACCOUNT_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const adminLogin = async (req, res) => {
  const { userName, password } = req.body;
  if (!userName || !password) {
    throw new BadRequestError('Username or Password should not be empty');
  }
  const admin = await Admin.findOne({ where: { userName: userName } });

  // An unknown username used to return 404 "<name> does not exist" while a
  // wrong password returned 401, which told an attacker which usernames are
  // real. Both now fail identically, and the comparison still runs when the
  // account is absent so the two paths take comparable time.
  const match = await compare(password, admin ? admin.password : ABSENT_ACCOUNT_HASH);
  if (!admin || !match) {
    throw new UnauthenticatedError('Wrong username and password combination');
  }

  const user = {
    id: admin.id,
    userName: admin.userName,
    role: 'admin',
  };
  const token = sign(user, env.adminSecret, {
    algorithm: 'HS256',
    expiresIn: env.sessionSeconds,
  });
  attachTokenToResponse('token', { res, token });
  res.json({ succeed: true, msg: 'successfully logged in' });
};

const adminLogout = (req, res) => {
  // `res.clearCookie('token')` did not match the attributes the cookie was set
  // with, so the browser could keep it. Clear it with the same attributes.
  clearTokenCookie(res, 'token');
  res.json({ succeed: true, msg: 'logout succes' });
};

const isAdminValidated = (req, res) => {
  res.json({ succeed: true, result: req.admin });
};

module.exports = {
  adminLogin,
  isAdminValidated,
  adminLogout,
};
