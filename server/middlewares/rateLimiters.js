'use strict';

const rateLimit = require('express-rate-limit');

/**
 * In-process request limits.
 *
 * Deliberately modest about what these achieve: the store is in memory, so the
 * counters reset on restart and are not shared between processes. They raise
 * the cost of credential stuffing and casual scraping. They are not
 * denial-of-service protection -- that belongs at the proxy or CDN, and a
 * horizontally scaled deployment needs a shared store.
 */

const minutes = (n) => n * 60 * 1000;

const shared = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // A 429 must never be cached and served to someone else.
  handler: (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(429).json({ msg: 'Too many requests, please try again later.' });
  },
};

// Constants rather than environment variables. These had four env keys between
// them and none had ever been set to anything but the default, which meant four
// more chances for a deployment to differ from what was tested.
const WINDOW_MS = minutes(15);

const apiLimiter = rateLimit({
  ...shared,
  windowMs: WINDOW_MS,
  limit: 600,
});

/**
 * Login is far stricter than the rest of the API. There is exactly one
 * administrator account, so a legitimate user needs a handful of attempts;
 * anything beyond that is someone guessing.
 */
const adminLoginLimiter = rateLimit({
  ...shared,
  windowMs: WINDOW_MS,
  limit: 10,
  skipSuccessfulRequests: true,
});

/**
 * Account management: change password, add or remove an administrator.
 *
 * A separate bucket from login, on purpose. These routes verify a password too,
 * so they need throttling, but sharing the login counter means anyone who can
 * reach the login endpoint can exhaust it and lock the real administrator out
 * of changing their own password. That turns a brute-force attempt into a small
 * denial of service against the person best placed to respond to it.
 *
 * More generous than login because the caller is already authenticated, and
 * `skipSuccessfulRequests` means only failures count: ordinary use never
 * approaches the limit, while repeated wrong-password attempts still stop
 * quickly.
 */
const adminAccountLimiter = rateLimit({
  ...shared,
  windowMs: WINDOW_MS,
  limit: 20,
  skipSuccessfulRequests: true,
});

module.exports = { apiLimiter, adminLoginLimiter, adminAccountLimiter };
