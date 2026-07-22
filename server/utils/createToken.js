const { sign } = require('jsonwebtoken');

const ADMIN_TOKEN_ALGORITHM = 'HS256';
const ADMIN_TOKEN_AUDIENCE = 'my-portfolio-admin';
const ADMIN_TOKEN_ISSUER = 'my-portfolio-api';
const ADMIN_TOKEN_LIFETIME = '1h';
const ADMIN_COOKIE_NAME = 'token';
const ADMIN_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;

const requireAdminSecret = () => {
  const jwtSecret = process.env.ADMIN_SECRET;

  if (!jwtSecret) {
    throw new Error('ADMIN_SECRET is required');
  }

  return jwtSecret;
};

const createAdminJWT = ({ id, userName }) =>
  sign(
    {
      id,
      userName,
      role: 'admin',
    },
    requireAdminSecret(),
    {
      algorithm: ADMIN_TOKEN_ALGORITHM,
      audience: ADMIN_TOKEN_AUDIENCE,
      expiresIn: ADMIN_TOKEN_LIFETIME,
      issuer: ADMIN_TOKEN_ISSUER,
      subject: String(id),
    }
  );

const getAdminCookieOptions = () => ({
  httpOnly: true,
  maxAge: ADMIN_COOKIE_MAX_AGE_MS,
  path: '/',
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  signed: true,
});

const attachTokenToResponse = ({ res, token }) => {
  res.cookie(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
};

const clearTokenFromResponse = (res) => {
  const { maxAge, ...clearOptions } = getAdminCookieOptions();

  res.clearCookie(ADMIN_COOKIE_NAME, clearOptions);
};

const getAdminTokenVerificationOptions = () => ({
  algorithms: [ADMIN_TOKEN_ALGORITHM],
  audience: ADMIN_TOKEN_AUDIENCE,
  issuer: ADMIN_TOKEN_ISSUER,
});

module.exports = {
  ADMIN_COOKIE_MAX_AGE_MS,
  ADMIN_COOKIE_NAME,
  attachTokenToResponse,
  clearTokenFromResponse,
  createAdminJWT,
  getAdminTokenVerificationOptions,
  requireAdminSecret,
};
