require('dotenv').config({ quiet: true });

const parseInteger = (name, fallback, minimum, maximum) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const value = Number(rawValue);
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`
    );
  }

  return value;
};

const parseBoolean = (name, fallback) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') return fallback;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new Error(`${name} must be either true or false`);
};

const createPool = (defaultMaximum) => {
  const max = parseInteger('DB_POOL_MAX', defaultMaximum, 1, 100);
  const min = parseInteger('DB_POOL_MIN', 0, 0, 20);

  if (min > max) {
    throw new Error('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  }

  return {
    max,
    min,
    acquire: parseInteger(
      'DB_POOL_ACQUIRE_MS',
      30_000,
      1_000,
      120_000
    ),
    idle: parseInteger('DB_POOL_IDLE_MS', 10_000, 1_000, 120_000),
  };
};

const createTlsOptions = () => {
  const tlsEnabled = parseBoolean('DB_SSL', false);
  const certificateAuthority = process.env.DB_SSL_CA;

  if (!tlsEnabled) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DB_SSL=true is required in production');
    }
    if (certificateAuthority) {
      throw new Error('DB_SSL_CA requires DB_SSL=true');
    }
    return undefined;
  }

  const ssl = { rejectUnauthorized: true };
  if (certificateAuthority) {
    ssl.ca = certificateAuthority.replace(/\\n/g, '\n');
  }

  return { ssl };
};

const createConfig = ({
  database,
  defaultPoolMaximum,
  host,
  password,
  port,
  username,
}) => {
  const config = {
    username,
    password,
    database,
    host,
    port,
    dialect: 'mysql',
    logging: false,
    pool: createPool(defaultPoolMaximum),
  };
  const dialectOptions = createTlsOptions();

  if (process.env.DATABASE_URL) {
    config.use_env_variable = 'DATABASE_URL';
  }
  if (dialectOptions) {
    config.dialectOptions = dialectOptions;
  }

  return config;
};

module.exports = {
  development: createConfig({
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'khalid_portfolio',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInteger('DB_PORT', 3306, 1, 65535),
    defaultPoolMaximum: 10,
  }),
  test: createConfig({
    username: process.env.TEST_DB_USER || process.env.DB_USER || 'root',
    password: process.env.TEST_DB_PASS || process.env.DB_PASS || '',
    database:
      process.env.TEST_DB_NAME || process.env.DB_NAME || 'portfolio_test',
    host: process.env.TEST_DB_HOST || process.env.DB_HOST || '127.0.0.1',
    port: parseInteger('TEST_DB_PORT', 3306, 1, 65535),
    defaultPoolMaximum: 5,
  }),
  production: createConfig({
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInteger('DB_PORT', 3306, 1, 65535),
    defaultPoolMaximum: 20,
  }),
};
