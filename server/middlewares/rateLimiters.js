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

const apiLimiter = rateLimit({
  ...shared,
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || minutes(15),
  limit: Number(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 600,
});

/**
 * Login is far stricter than the rest of the API. There is exactly one
 * administrator account, so a legitimate user needs a handful of attempts;
 * anything beyond that is someone guessing.
 */
const adminLoginLimiter = rateLimit({
  ...shared,
  windowMs: Number(process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS) || minutes(15),
  limit: Number(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX_REQUESTS) || 10,
  skipSuccessfulRequests: true,
});

module.exports = { apiLimiter, adminLoginLimiter };
