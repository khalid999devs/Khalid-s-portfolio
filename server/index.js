require('dotenv').config();
require('express-async-errors');
const express = require('express');
const app = express();
// Validates configuration before anything binds a port, so a missing or weak
// secret is a clear startup failure rather than a silent default. Reported as
// one readable line: an operator reading a deploy log should not have to parse
// a stack trace to learn that a variable is missing.
let env;
try {
  env = require('./config/env');
} catch (error) {
  console.error(`\nConfiguration error: ${error.message}\n`);
  process.exit(1);
}
const db = require('./models');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { UPLOADS_ROOT } = require('./utils/uploadPaths');
const {
  apiLimiter,
  adminLoginLimiter,
} = require('./middlewares/rateLimiters');

// Behind a reverse proxy the client address is the proxy's without this, so
// rate limits would bucket every visitor together. The hop count is explicit;
// trusting an unbounded chain lets a client forge X-Forwarded-For.
app.set('trust proxy', env.trustProxyHops);

// Express advertises itself in every response by default.
app.disable('x-powered-by');

// This is an API and a media host, not an HTML origin. The important header
// here is nosniff: /uploads serves user-supplied bytes, and without it a
// browser may sniff a stored file into something renderable. The CSP is the
// restrictive API default -- it does not apply to the separately hosted client.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'img-src': ["'self'"],
        'media-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    // Media is fetched by a browser from a different origin than the page.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

app.use(compression());

//cors
const whitelist = env.allowedOrigins;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The origin decision needs the request method, so options are resolved
 * per-request rather than once at startup.
 *
 * The previous rule was `whitelist.indexOf(origin) !== -1 || !origin`. That
 * second clause allowed *any* request that simply omitted an Origin header,
 * including state-changing ones. Reads still allow it -- curl, health checks
 * and server-to-server calls legitimately have no Origin -- but a write now
 * has to come from a known browser origin.
 */
app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const allowed =
      whitelist.includes(origin) || (!origin && SAFE_METHODS.has(req.method));

    callback(null, {
      origin: allowed ? origin || true : false,
      optionsSuccessStatus: 200,
      credentials: true,
      // Cached responses must not be shared between origins.
      preflightContinue: false,
    });
  })
);

//middlewares
// Was unbounded on both. Express defaults to 100kb for json, but urlencoded
// with `extended: true` and no limit let a single request allocate freely.
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(
  express.urlencoded({ extended: true, limit: env.urlEncodedBodyLimit, parameterLimit: 200 })
);
// Was `cookieParser('secret')` -- the signing key for every session cookie was
// a literal committed to this file, so anyone reading the repository could
// forge a validly signed cookie.
app.use(cookieParser(env.cookieSecret));

/**
 * Filenames generated since the upload rewrite are `<field>_<32 hex>.<ext>`:
 * random, and never reused, because a replacement gets a fresh name. Those can
 * be cached indefinitely.
 *
 * Legacy filenames are `<field>_<title-slug>@<timestamp>.<ext>` and are not
 * safe to treat that way -- a re-upload under the same title could in principle
 * collide -- so they revalidate with an ETag instead.
 */
const IMMUTABLE_MEDIA_NAME = /^(bannerImg|videos|thumbnailContents|sliderContents)_[0-9a-f]{32}\.[a-z0-9]+$/;

app.use(
  '/uploads',
  express.static(UPLOADS_ROOT, {
    // A stored file must never be executed or listed, only served.
    dotfiles: 'deny',
    index: false,
    // Without this a request for a directory redirects, revealing which
    // directories exist.
    redirect: false,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');

      const name = filePath.split(/[\\/]/).pop();
      res.setHeader(
        'Cache-Control',
        IMMUTABLE_MEDIA_NAME.test(name)
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate'
      );
    },
  })
);

app.use('/api/', apiLimiter);

//routers
const adminRouter = require('./routers/admin');
const contactRouter = require('./routers/contact');
const projectRouter = require('./routers/projects');
const settingRouter = require('./routers/settings');

app.use('/api/admin/login', adminLoginLimiter);
app.use('/api/admin', adminRouter);
app.use('/api/contact', contactRouter);
app.use('/api/projects', projectRouter);
app.use('/api/settings', settingRouter);

//notfound and errors
const errorHandlerMiddleWare = require('./middlewares/errorHandler');
const notFoundMiddleWare = require('./middlewares/notFound');

app.use(notFoundMiddleWare);
app.use(errorHandlerMiddleWare);

//ports and start
const PORT = process.env.PORT || 8000;

// `db.sequelize.sync()` used to run here on every boot, so the live schema was
// whatever the models happened to say, with no record of what had been applied.
// Schema changes are now explicit and versioned: `npm run migrate`.
db.sequelize
  .authenticate()
  .then(() => {
    console.log(`database connected`);
    app.listen(PORT, () => {
      console.log(`server is running on port ${PORT}...`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
