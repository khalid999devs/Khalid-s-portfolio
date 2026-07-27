'use strict';

/**
 * API 404s answer JSON, matching every other response from these routes, and
 * are never cached -- a route that does not exist today may exist after the
 * next deploy.
 *
 * The previous version sent `text/html` for `/api/...` misses, which the client
 * then tried to read as JSON.
 */
const notFound = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ msg: 'Route does not exist' });
  }
  return res.status(404).type('text/plain').send('Route does not exist');
};

module.exports = notFound;
