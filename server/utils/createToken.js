const { sign } = require('jsonwebtoken');
const env = require('../config/env');

const createJWT = ({ payload, jwtSecret, jwtLifeTime }) => {
  const token = sign(payload, jwtSecret, {
    expiresIn: jwtLifeTime,
  });
  return token;
};

const attachTokenToResponse = (tokenName, { res, token }) => {
  res.cookie(tokenName || 'token', token, {
    httpOnly: true,
    // Was commented out. Without it the session cookie travels over plain HTTP
    // whenever anything downgrades the connection.
    secure: env.cookieSecure,
    // Was absent entirely, so the cookie defaulted to being sent on
    // cross-site requests.
    sameSite: env.cookieSameSite,
    path: '/',
    // Matches the token's own lifetime. The cookie used to outlive the token by
    // 23 hours, so the browser kept presenting a credential the server had
    // already stopped accepting.
    maxAge: env.sessionSeconds * 1000,
    signed: true,
  });
};

const clearTokenCookie = (res, tokenName) => {
  // Clearing only works when the attributes match those the cookie was set with.
  res.clearCookie(tokenName || 'token', {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    signed: true,
  });
};

module.exports = {
  createJWT,
  attachTokenToResponse,
  clearTokenCookie,
};
