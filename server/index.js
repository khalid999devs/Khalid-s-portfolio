require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const { UnauthorizedError } = require('./errors');

const MINIMUM_SECRET_LENGTH = 32;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

const parseBoundedInteger = (
  env,
  variableName,
  { defaultValue, maximum, minimum }
) => {
  const rawValue = env[variableName];

  if (rawValue === undefined || String(rawValue).trim() === '') {
    return defaultValue;
  }

  const normalizedValue = String(rawValue).trim();
  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(
      `${variableName} must be an integer between ${minimum} and ${maximum}`
    );
  }

  const value = Number(normalizedValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${variableName} must be an integer between ${minimum} and ${maximum}`
    );
  }

  return value;
};

const parseAllowedOrigins = (value) => {
  const configuredOrigins = value
    ? value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];

  return [
    ...new Set(
      configuredOrigins.map((origin) => {
        try {
          const parsedOrigin = new URL(origin);

          if (
            !['http:', 'https:'].includes(parsedOrigin.protocol) ||
            parsedOrigin.username ||
            parsedOrigin.password
          ) {
            throw new Error('unsupported browser origin');
          }

          return parsedOrigin.origin;
        } catch (_error) {
          throw new Error(
            `REMOTE_CLIENT_APP contains an invalid URL (HTTP(S) origins only): ${origin}`
          );
        }
      })
    ),
  ];
};

const validateRuntimeConfig = (env = process.env) => {
  const isProduction = env.NODE_ENV === 'production';
  const requiredVariables = ['ADMIN_SECRET', 'COOKIE_SECRET', 'NODE_ENV'];

  if (isProduction) {
    requiredVariables.push('REMOTE_CLIENT_APP');

    if (!env.DATABASE_URL?.trim()) {
      requiredVariables.push('DB_HOST', 'DB_NAME', 'DB_PASS', 'DB_USER');
    }
  }

  const missingVariables = requiredVariables.filter(
    (variableName) => !String(env[variableName] || '').trim()
  );

  if (missingVariables.length) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`
    );
  }

  if (!['development', 'production', 'test'].includes(env.NODE_ENV)) {
    throw new Error('NODE_ENV must be development, production, or test');
  }

  for (const variableName of ['ADMIN_SECRET', 'COOKIE_SECRET']) {
    if (env[variableName].length < MINIMUM_SECRET_LENGTH) {
      throw new Error(
        `${variableName} must contain at least ${MINIMUM_SECRET_LENGTH} characters`
      );
    }
  }

  if (env.ADMIN_SECRET === env.COOKIE_SECRET) {
    throw new Error('ADMIN_SECRET and COOKIE_SECRET must be different');
  }

  const allowedOrigins = parseAllowedOrigins(
    env.REMOTE_CLIENT_APP || 'http://localhost:5173'
  );

  if (
    isProduction &&
    allowedOrigins.some((origin) => new URL(origin).protocol !== 'https:')
  ) {
    throw new Error('REMOTE_CLIENT_APP must use HTTPS in production');
  }

  const port = parseBoundedInteger(env, 'PORT', {
    defaultValue: 8000,
    minimum: 1,
    maximum: 65535,
  });
  const trustProxyHops = parseBoundedInteger(env, 'TRUST_PROXY_HOPS', {
    defaultValue: 0,
    minimum: 0,
    maximum: 10,
  });

  const rateLimits = {
    api: {
      windowMs: parseBoundedInteger(env, 'API_RATE_LIMIT_WINDOW_MS', {
        defaultValue: 15 * ONE_MINUTE_MS,
        minimum: 1000,
        maximum: 24 * ONE_HOUR_MS,
      }),
      limit: parseBoundedInteger(env, 'API_RATE_LIMIT_MAX_REQUESTS', {
        defaultValue: 300,
        minimum: 1,
        maximum: 100_000,
      }),
    },
    adminLogin: {
      windowMs: parseBoundedInteger(
        env,
        'ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS',
        {
          defaultValue: 15 * ONE_MINUTE_MS,
          minimum: 1000,
          maximum: 24 * ONE_HOUR_MS,
        }
      ),
      limit: parseBoundedInteger(
        env,
        'ADMIN_LOGIN_RATE_LIMIT_MAX_REQUESTS',
        {
          defaultValue: 10,
          minimum: 1,
          maximum: 10_000,
        }
      ),
    },
    contactSubmission: {
      windowMs: parseBoundedInteger(
        env,
        'CONTACT_RATE_LIMIT_WINDOW_MS',
        {
          defaultValue: ONE_HOUR_MS,
          minimum: 1000,
          maximum: 24 * ONE_HOUR_MS,
        }
      ),
      limit: parseBoundedInteger(
        env,
        'CONTACT_RATE_LIMIT_MAX_REQUESTS',
        {
          defaultValue: 5,
          minimum: 1,
          maximum: 10_000,
        }
      ),
    },
  };

  return {
    allowedOrigins,
    cookieSecret: env.COOKIE_SECRET,
    isProduction,
    port,
    rateLimits,
    trustProxyHops,
  };
};

const createCorsOptions = (allowedOrigins) => ({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const error = new Error('Origin not allowed');
      error.statusCode = 403;
      callback(error);
    }
  },
  credentials: true,
  maxAge: 600,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
});

const SAFE_REQUEST_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const createUnsafeRequestOriginGuard = (allowedOrigins) => (req, _res, next) => {
  if (SAFE_REQUEST_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');
  if (!origin || !allowedOrigins.includes(origin)) {
    next(new UnauthorizedError('Request origin is not allowed'));
    return;
  }

  next();
};

const createHelmetOptions = (isProduction) => ({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      baseUri: ["'none'"],
      defaultSrc: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },
  hsts: isProduction
    ? { includeSubDomains: true, maxAge: 31_536_000, preload: false }
    : false,
  referrerPolicy: { policy: 'no-referrer' },
});

const createRateLimitHandler = (message) => (_req, res, _next, options) =>
  res.status(options.statusCode).json({
    succeed: false,
    msg: message,
  });

const createLimiter = ({ limit, message, windowMs }) =>
  rateLimit({
    handler: createRateLimitHandler(message),
    legacyHeaders: false,
    limit,
    skip: (req) => req.method === 'OPTIONS',
    standardHeaders: 'draft-8',
    windowMs,
  });

const createRateLimiters = (rateLimits) => ({
  adminLogin: createLimiter({
    ...rateLimits.adminLogin,
    message: 'Too many login attempts. Please try again later.',
  }),
  api: createLimiter({
    ...rateLimits.api,
    message: 'Too many requests. Please try again later.',
  }),
  contactSubmission: createLimiter({
    ...rateLimits.contactSubmission,
    message: 'Too many contact submissions. Please try again later.',
  }),
});

const createApp = (env = process.env, runtimeConfig) => {
  const config = runtimeConfig || validateRuntimeConfig(env);
  const app = express();
  const limiters = createRateLimiters(config.rateLimits);

  app.disable('x-powered-by');
  app.set('json escape', true);
  app.set('query parser', 'simple');
  app.set('trust proxy', config.trustProxyHops);
  app.use(helmet(createHelmetOptions(config.isProduction)));
  app.use(cors(createCorsOptions(config.allowedOrigins)));
  app.use('/api', createUnsafeRequestOriginGuard(config.allowedOrigins));

  app.use('/api', limiters.api);
  app.post('/api/admin/login', limiters.adminLogin);
  app.post('/api/contact/sendMessage', limiters.contactSubmission);

  app.use(express.json({ limit: env.JSON_BODY_LIMIT || '256kb' }));
  app.use(
    express.urlencoded({
      extended: false,
      limit: env.URL_ENCODED_BODY_LIMIT || '64kb',
      parameterLimit: 100,
    })
  );
  app.use(cookieParser(config.cookieSecret));

  app.use(
    '/uploads',
    express.static(path.join(__dirname, 'uploads'), {
      dotfiles: 'deny',
      index: false,
    })
  );

  const adminRouter = require('./routers/admin');
  const contactRouter = require('./routers/contact');
  const projectRouter = require('./routers/projects');
  const settingRouter = require('./routers/settings');

  app.use('/api/admin', adminRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/settings', settingRouter);

  const errorHandlerMiddleWare = require('./middlewares/errorHandler');
  const notFoundMiddleWare = require('./middlewares/notFound');

  app.use(notFoundMiddleWare);
  app.use(errorHandlerMiddleWare);

  return app;
};

const startServer = async () => {
  const runtimeConfig = validateRuntimeConfig(process.env);
  const app = createApp(process.env, runtimeConfig);
  const db = require('./models');

  await db.sequelize.sync();
  console.log('database connected');

  const server = app.listen(runtimeConfig.port, () => {
    console.log(`server is running on port ${runtimeConfig.port}...`);
  });

  return { app, server };
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server failed to start:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createApp,
  createHelmetOptions,
  createRateLimiters,
  createUnsafeRequestOriginGuard,
  parseAllowedOrigins,
  startServer,
  validateRuntimeConfig,
};
