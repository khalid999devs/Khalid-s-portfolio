'use strict';

/**
 * The single definition of what an administrator credential may be.
 *
 * `scripts/admin-account.js` enforced these rules for the CLI, and the panel
 * now enforces the same ones by importing them. Two copies of a password policy
 * is how you end up with a 16 character minimum on one path and no minimum on
 * the other, and an attacker only needs the weaker path.
 */

const MINIMUM_PASSWORD_LENGTH = 16;
const MAXIMUM_PASSWORD_LENGTH = 512;
const DEFAULT_BCRYPT_COST = 12;

/**
 * Cost factor. A constant, not an environment variable.
 *
 * It was read from SALT or ADMIN_PASSWORD_BCRYPT_COST and clamped to 10..15,
 * which meant the strength of every stored password depended on a value nobody
 * had ever set. Worse, changing it silently would not rehash existing
 * passwords, so a deployment could end up with a mix. Raising it is a code
 * change, which is what it deserves to be.
 */
const bcryptCost = () => DEFAULT_BCRYPT_COST;

/** Returns an error message, or null when the username is acceptable. */
const userNameProblem = (userName) => {
  if (typeof userName !== 'string') return 'Username is required.';
  const trimmed = userName.trim();
  if (trimmed !== userName) {
    return 'Username must not start or end with whitespace.';
  }
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(trimmed)) {
    return 'Username must be 3 to 64 characters, using letters, digits, dot, underscore or hyphen.';
  }
  return null;
};

/** Returns an error message, or null when the password is acceptable. */
const passwordProblem = (password) => {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAXIMUM_PASSWORD_LENGTH) {
    // bcrypt only reads the first 72 bytes anyway; the cap is about refusing to
    // hash an unbounded body, not about strength.
    return `Password must be at most ${MAXIMUM_PASSWORD_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(password)) {
    return 'Password must not start or end with whitespace.';
  }
  return null;
};

module.exports = {
  MINIMUM_PASSWORD_LENGTH,
  MAXIMUM_PASSWORD_LENGTH,
  bcryptCost,
  userNameProblem,
  passwordProblem,
};
