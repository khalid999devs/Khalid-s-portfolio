'use strict';

/**
 * Validates runtime configuration once, at startup, and fails closed.
 *
 * Previously the cookie signing key was the literal string 'secret' committed in
 * index.js, and a missing REMOTE_CLIENT_APP crashed with a TypeError deep in the
 * CORS setup. Configuration problems should be a single clear message on boot,
 * not a weak default that runs happily in production.
 *
 * The environment is deliberately small. It used to carry 37 keys, 19 of which
 * no code read at all, and most of the rest were tuning knobs that had never
 * been turned. Anything with one sensible value is a constant in this file now,
 * where it can be seen and changed with a commit, rather than a variable that
 * has to be right on every machine and is silently wrong when it is not.
 *
 * The rule applied: it belongs in the environment only if it is a secret, or it
 * genuinely differs between a laptop and production.
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
 * same-site, because SameSite is evaluated on the registrable domain rather
 * than the host. 'lax' is therefore correct both for the real deployment and
 * for localhost, and it is the CSRF defence for every cookie-authenticated
 * write on this API.
 *
 * Hardcoded because there is one right answer for this deployment. Hosting the
 * client on an unrelated domain would make requests genuinely cross-site and
 * require 'none' plus secure cookies, which is a deliberate change to make
 * here, not a variable to get wrong in an environment file.
 */
const COOKIE_SAME_SITE = 'lax';

/**
 * Cookie lifetime tracks the token lifetime. They used to disagree, a one hour
 * token inside a twenty four hour cookie, so for twenty three hours the browser
 * kept sending a credential the server had already rejected.
 */
const SESSION_MINUTES = 60;

/** Enough for a project description with base64 nothing; uploads go multipart. */
const BODY_LIMIT = '256kb';

/**
 * Number of reverse-proxy hops to trust for the client address.
 *
 * The one piece of infrastructure tuning that genuinely differs per deployment,
 * so it stays in the environment. Too low and every visitor shares the proxy's
 * address, so rate limits bucket them together; too high and a client can forge
 * X-Forwarded-For to appear as any address it likes.
 */
const trustProxyHops = (() => {
  const value = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10.');
  }
  return value;
})();

module.exports = {
  isProduction,
  adminSecret,
  cookieSecret,
  cookieSameSite: COOKIE_SAME_SITE,
  cookieSecure: isProduction(),
  sessionMinutes: SESSION_MINUTES,
  sessionSeconds: SESSION_MINUTES * 60,
  trustProxyHops,
  jsonBodyLimit: BODY_LIMIT,
  urlEncodedBodyLimit: BODY_LIMIT,
  allowedOrigins: allowedOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
