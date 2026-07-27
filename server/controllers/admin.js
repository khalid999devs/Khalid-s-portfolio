const { compare, hash } = require('bcryptjs');
const { Admin } = require('../models');
const { sign } = require('jsonwebtoken');
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require('../errors');
const {
  bcryptCost,
  userNameProblem,
  passwordProblem,
} = require('../utils/adminCredentials');
const {
  attachTokenToResponse,
  clearTokenCookie,
} = require('../utils/createToken');
const env = require('../config/env');

/**
 * A bcrypt hash of a random value, compared against when the username is
 * unknown so that the failure path does the same work as a real one.
 *
 * The cost factor has to match what real accounts are hashed at, which is 12.
 * It was previously a cost 10 hash, and cost is exponential: an unknown
 * username answered in about 55ms while a real one took about 206ms. That
 * difference is trivially measurable over a network and reintroduces exactly
 * the username enumeration the equal-message handling below exists to prevent.
 */
const ABSENT_ACCOUNT_HASH =
  '$2b$12$fvC1r4RRInqd6GWah3U8nebMq5KTn5KDd.dmFvlDA6VuYwz5JWjZy';

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

/**
 * Lists administrator accounts for the panel.
 *
 * The old public `GET /api/admin` returned every username to anyone who asked,
 * which is a list of valid login names handed to an attacker. This one is
 * behind `adminValidate`, and it returns only what the panel renders: id,
 * username, and when the account was created. Password hashes are never
 * selected, rather than selected and then deleted.
 */
const listAdmins = async (req, res) => {
  const admins = await Admin.findAll({
    attributes: ['id', 'userName', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });

  res.json({
    succeed: true,
    result: admins,
    // Lets the panel disable "remove" on the last remaining account without a
    // second request.
    total: admins.length,
  });
};

/**
 * Changes the signed-in administrator's own password.
 *
 * Requires the current password even though the session already proves who
 * they are. A session cookie can be left open on a shared machine; knowing the
 * old password is what proves the person at the keyboard is the account owner.
 */
const changeOwnPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || currentPassword === '') {
    throw new BadRequestError('Your current password is required.');
  }

  const problem = passwordProblem(newPassword);
  if (problem) throw new BadRequestError(problem);

  if (newPassword === currentPassword) {
    throw new BadRequestError('The new password must be different from the current one.');
  }

  const admin = await Admin.findByPk(req.admin.id);
  if (!admin) throw new NotFoundError('This account no longer exists.');

  if (!(await compare(currentPassword, admin.password))) {
    throw new UnauthenticatedError('Your current password is not correct.');
  }

  await admin.update({ password: await hash(newPassword, bcryptCost()) });

  res.json({
    succeed: true,
    msg: 'Password updated. Sessions on other devices are unaffected, so rotate the cookie secret if you believe one is compromised.',
  });
};

/**
 * Creates an additional administrator.
 *
 * This is not the old `POST /reg`. That route was unauthenticated: anyone could
 * mint themselves a full administrator session. This one requires an existing
 * administrator session and the creator's own password, so a stolen cookie
 * alone cannot be used to establish a second, quieter way back in.
 */
const createAdmin = async (req, res) => {
  const { userName, password, currentPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || currentPassword === '') {
    throw new BadRequestError('Confirm the action with your own password.');
  }

  const nameProblem = userNameProblem(userName);
  if (nameProblem) throw new BadRequestError(nameProblem);

  const pwProblem = passwordProblem(password);
  if (pwProblem) throw new BadRequestError(pwProblem);

  const creator = await Admin.findByPk(req.admin.id);
  if (!creator) throw new NotFoundError('This account no longer exists.');

  if (!(await compare(currentPassword, creator.password))) {
    throw new UnauthenticatedError('Your password is not correct.');
  }

  const taken = await Admin.findOne({ where: { userName } });
  if (taken) throw new BadRequestError('That username is already taken.');

  const created = await Admin.create({
    userName,
    password: await hash(password, bcryptCost()),
  });

  res.status(201).json({
    succeed: true,
    msg: `Created administrator "${created.userName}".`,
    result: {
      id: created.id,
      userName: created.userName,
      createdAt: created.createdAt,
    },
  });
};

/**
 * Removes another administrator.
 *
 * Two refusals matter here. Deleting yourself locks you out of the session you
 * are using, and deleting the last account locks everyone out permanently, with
 * shell access to the database server the only way back.
 */
const removeAdmin = async (req, res) => {
  const { currentPassword } = req.body || {};
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new BadRequestError('A valid administrator id is required.');
  }
  if (typeof currentPassword !== 'string' || currentPassword === '') {
    throw new BadRequestError('Confirm the action with your own password.');
  }
  if (id === req.admin.id) {
    throw new BadRequestError('You cannot remove the account you are signed in as.');
  }

  const actor = await Admin.findByPk(req.admin.id);
  if (!actor) throw new NotFoundError('This account no longer exists.');
  if (!(await compare(currentPassword, actor.password))) {
    throw new UnauthenticatedError('Your password is not correct.');
  }

  const target = await Admin.findByPk(id);
  if (!target) throw new NotFoundError('That administrator does not exist.');

  if ((await Admin.count()) <= 1) {
    throw new BadRequestError('The last administrator account cannot be removed.');
  }

  await target.destroy();
  res.json({ succeed: true, msg: `Removed administrator "${target.userName}".` });
};

module.exports = {
  adminLogin,
  isAdminValidated,
  adminLogout,
  listAdmins,
  changeOwnPassword,
  createAdmin,
  removeAdmin,
};
