'use strict';

/**
 * Validates runtime configuration once, at startup, and fails closed.
 *
 * Previously the cookie signing key was the literal string 'secret' committed in
 * index.js, and a missing REMOTE_CLIENT_APP crashed with a TypeError deep in the
 * CORS setup. Configuration problems should be a single clear message on boot,
 * not a weak default that runs happily in production.
 */

const isProduction = () => process.env.NODE_ENV === 'production';

const MINIMUM_SECRET_LENGTH = 32;

const missing = [];
const weak = [];

const requireSecret = (name) => {
  const value = process.env[name];
  if (!value) {
    missing.push(name);
    return '';
  }
  // Only enforced in production so local development is not blocked by a short
  // throwaway value, but the check is reported either way.
  if (value.length < MINIMUM_SECRET_LENGTH) weak.push(name);
  return value;
};

const requirePresent = (name) => {
  const value = process.env[name];
  if (!value) missing.push(name);
  return value || '';
};

const adminSecret = requireSecret('ADMIN_SECRET');
const cookieSecret = requireSecret('COOKIE_SECRET');
const allowedOriginsRaw = requirePresent('REMOTE_CLIENT_APP');

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'See server/.env.example. The server will not start without them.'
  );
}

if (weak.length > 0) {
  const message =
    `Secret(s) shorter than ${MINIMUM_SECRET_LENGTH} characters: ${weak.join(', ')}. ` +
    'Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"';
  if (isProduction()) throw new Error(message);
  process.emitWarning(message);
}

if (cookieSecret === adminSecret) {
  const message =
    'COOKIE_SECRET and ADMIN_SECRET are identical. Use independent values so ' +
    'compromising one does not compromise the other.';
  if (isProduction()) throw new Error(message);
  process.emitWarning(message);
}

/**
 * Cross-subdomain requests (khalidahammed.com -> api.khalidahammed.com) are
 * same-site, because SameSite is evaluated on the registrable domain rather than
 * the host, so 'lax' is correct for the current deployment and for localhost.
 * It is configurable because hosting the client on an unrelated domain would
 * make the request genuinely cross-site and require 'none' with secure cookies.
 */
const cookieSameSite = (() => {
  const value = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(value)) {
    throw new Error(`COOKIE_SAME_SITE must be lax, strict or none (received "${value}").`);
  }
  if (value === 'none' && !isProduction()) {
    process.emitWarning('COOKIE_SAME_SITE=none requires secure cookies, which need HTTPS.');
  }
  return value;
})();

// Cookie lifetime tracks the token lifetime. They used to disagree -- a 1 hour
// token inside a 24 hour cookie -- so for 23 hours the browser kept sending a
// credential the server had already rejected.
const SESSION_MINUTES = (() => {
  const value = Number(process.env.ADMIN_SESSION_MINUTES || 60);
  if (!Number.isInteger(value) || value < 5 || value > 1440) {
    throw new Error('ADMIN_SESSION_MINUTES must be an integer between 5 and 1440.');
  }
  return value;
})();

/**
 * Number of reverse-proxy hops to trust for the client address.
 *
 * Must match the deployment exactly. Too low and every visitor shares the
 * proxy's address, so rate limits bucket them together; too high (or `true`)
 * and a client can forge X-Forwarded-For to appear as any address it likes.
 */
const trustProxyHops = (() => {
  const value = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10.');
  }
  return value;
})();

const bodyLimit = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (!/^\d+(\.\d+)?(b|kb|mb)$/i.test(value)) {
    throw new Error(`${name} must look like "100kb" or "2mb" (received "${value}").`);
  }
  return value;
};

module.exports = {
  isProduction,
  adminSecret,
  cookieSecret,
  cookieSameSite,
  cookieSecure: isProduction(),
  sessionMinutes: SESSION_MINUTES,
  sessionSeconds: SESSION_MINUTES * 60,
  trustProxyHops,
  jsonBodyLimit: bodyLimit('JSON_BODY_LIMIT', '256kb'),
  urlEncodedBodyLimit: bodyLimit('URL_ENCODED_BODY_LIMIT', '256kb'),
  allowedOrigins: allowedOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
