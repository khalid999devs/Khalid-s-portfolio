const nodemailer = require('nodemailer');

const { htmlCreator } = require('./htmlTemplates');
const { EmailCover } = require('./TemplateCover');

const DEFAULT_SMTP_PORT = 465;
const DEFAULT_FROM_NAME = 'Khalid Ahammed';
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_GREETING_TIMEOUT_MS = 10_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 30_000;
const DEFAULT_POOL_MAX_CONNECTIONS = 3;
const DEFAULT_POOL_MAX_MESSAGES = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedTransporter;
let cachedTransportOptions;

class EmailDeliveryError extends Error {
  constructor(message = 'Email delivery is temporarily unavailable.') {
    super(message);
    this.name = 'EmailDeliveryError';
    this.statusCode = 502;
    this.code = 'EMAIL_DELIVERY_FAILED';
  }
}

const requireConfigValue = (environment, key) => {
  const value = environment[key];

  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${key} is required for email delivery.`);
    error.code = 'EMAIL_CONFIGURATION_INVALID';
    throw error;
  }

  return value.trim();
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;

  const error = new Error('MAIL_SECURE must be either true or false.');
  error.code = 'EMAIL_CONFIGURATION_INVALID';
  throw error;
};

const parseBoundedInteger = (
  environment,
  key,
  { defaultValue, minimum, maximum }
) => {
  const rawValue = environment[key];
  if (rawValue === undefined || String(rawValue).trim() === '') {
    return defaultValue;
  }

  const normalizedValue = String(rawValue).trim();
  if (!/^\d+$/u.test(normalizedValue)) {
    const error = new Error(
      `${key} must be an integer between ${minimum} and ${maximum}.`
    );
    error.code = 'EMAIL_CONFIGURATION_INVALID';
    throw error;
  }

  const value = Number(normalizedValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    const error = new Error(
      `${key} must be an integer between ${minimum} and ${maximum}.`
    );
    error.code = 'EMAIL_CONFIGURATION_INVALID';
    throw error;
  }

  return value;
};

const getMailConfig = (environment = process.env) => {
  const host = requireConfigValue(environment, 'MAIL_HOST');
  const user = requireConfigValue(environment, 'SERVER_EMAIL');
  const password = requireConfigValue(environment, 'MAIL_PASS');
  const port = environment.MAIL_PORT
    ? Number(environment.MAIL_PORT)
    : DEFAULT_SMTP_PORT;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error('MAIL_PORT must be a valid TCP port.');
    error.code = 'EMAIL_CONFIGURATION_INVALID';
    throw error;
  }

  if (!EMAIL_PATTERN.test(user) || user.length > 254) {
    const error = new Error('SERVER_EMAIL must be a valid email address.');
    error.code = 'EMAIL_CONFIGURATION_INVALID';
    throw error;
  }

  const secure = parseBoolean(environment.MAIL_SECURE, port === 465);
  const fromName =
    environment.MAIL_FROM_NAME?.trim() || DEFAULT_FROM_NAME;
  const connectionTimeout = parseBoundedInteger(
    environment,
    'MAIL_CONNECTION_TIMEOUT_MS',
    { defaultValue: DEFAULT_CONNECTION_TIMEOUT_MS, minimum: 1_000, maximum: 60_000 }
  );
  const greetingTimeout = parseBoundedInteger(
    environment,
    'MAIL_GREETING_TIMEOUT_MS',
    { defaultValue: DEFAULT_GREETING_TIMEOUT_MS, minimum: 1_000, maximum: 60_000 }
  );
  const socketTimeout = parseBoundedInteger(
    environment,
    'MAIL_SOCKET_TIMEOUT_MS',
    { defaultValue: DEFAULT_SOCKET_TIMEOUT_MS, minimum: 1_000, maximum: 120_000 }
  );
  const maxConnections = parseBoundedInteger(
    environment,
    'MAIL_POOL_MAX_CONNECTIONS',
    { defaultValue: DEFAULT_POOL_MAX_CONNECTIONS, minimum: 1, maximum: 10 }
  );
  const maxMessages = parseBoundedInteger(
    environment,
    'MAIL_POOL_MAX_MESSAGES',
    { defaultValue: DEFAULT_POOL_MAX_MESSAGES, minimum: 1, maximum: 1_000 }
  );

  return {
    fromName,
    fromAddress: user,
    transport: {
      pool: true,
      host,
      port,
      secure,
      requireTLS: !secure,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      maxConnections,
      maxMessages,
      auth: {
        user,
        pass: password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
    },
  };
};

const hasSameTransportOptions = (left, right) =>
  Boolean(left && right) &&
  left.pool === right.pool &&
  left.host === right.host &&
  left.port === right.port &&
  left.secure === right.secure &&
  left.requireTLS === right.requireTLS &&
  left.connectionTimeout === right.connectionTimeout &&
  left.greetingTimeout === right.greetingTimeout &&
  left.socketTimeout === right.socketTimeout &&
  left.maxConnections === right.maxConnections &&
  left.maxMessages === right.maxMessages &&
  left.auth?.user === right.auth?.user &&
  left.auth?.pass === right.auth?.pass &&
  left.tls?.minVersion === right.tls?.minVersion &&
  left.tls?.rejectUnauthorized === right.tls?.rejectUnauthorized;

const closeTransporter = (transporter) => {
  if (typeof transporter?.close !== 'function') return;
  transporter.close();
};

const closeMailTransporter = () => {
  const transporter = cachedTransporter;
  cachedTransporter = undefined;
  cachedTransportOptions = undefined;
  closeTransporter(transporter);
};

const getMailTransporter = (transportOptions) => {
  if (
    cachedTransporter &&
    hasSameTransportOptions(cachedTransportOptions, transportOptions)
  ) {
    return cachedTransporter;
  }

  closeMailTransporter();
  cachedTransporter = nodemailer.createTransport(transportOptions);
  cachedTransportOptions = transportOptions;
  return cachedTransporter;
};

const discardMailTransporter = (transporter) => {
  if (transporter !== cachedTransporter) return;
  closeMailTransporter();
};

const validateMailData = (data) => {
  const recipient = data?.client?.email;
  const normalizedRecipient =
    typeof recipient === 'string' ? recipient.trim() : recipient;

  if (
    typeof normalizedRecipient !== 'string' ||
    normalizedRecipient.length > 254 ||
    !EMAIL_PATTERN.test(normalizedRecipient)
  ) {
    const error = new Error('A valid recipient email is required.');
    error.code = 'EMAIL_INPUT_INVALID';
    error.statusCode = 400;
    throw error;
  }

  return normalizedRecipient;
};

const safeProviderCode = (error) => {
  const value = error?.code || error?.responseCode || 'UNKNOWN';
  return String(value).replace(/[^A-Z0-9_-]/gi, '').slice(0, 40) || 'UNKNOWN';
};

const mailer = async (data, mode) => {
  let config;
  let recipient;

  try {
    config = getMailConfig();
    recipient = validateMailData(data);
  } catch (error) {
    if (error.statusCode === 400) throw error;

    console.error('Email delivery configuration is invalid.', {
      code: safeProviderCode(error),
    });
    throw new EmailDeliveryError();
  }

  const { subject, body, text } = htmlCreator(mode, data);
  let transporter;

  try {
    transporter = getMailTransporter(config.transport);
    const delivery = await transporter.sendMail({
      from: {
        name: config.fromName,
        address: config.fromAddress,
      },
      to: recipient,
      subject:
        typeof subject === 'string'
          ? subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 998)
          : '',
      html: body ? EmailCover(body, config.fromName) : undefined,
      text: text || undefined,
    });

    if (Array.isArray(delivery.rejected) && delivery.rejected.length > 0) {
      throw Object.assign(new Error('SMTP recipient rejected.'), {
        code: 'SMTP_RECIPIENT_REJECTED',
      });
    }

    return { status: 'accepted' };
  } catch (error) {
    // A failed pooled connection is discarded so the next attempt starts from
    // a clean socket instead of inheriting a potentially broken SMTP session.
    discardMailTransporter(transporter);
    // Log only a bounded provider code. SMTP responses can contain recipient
    // addresses and infrastructure details, so raw provider errors stay out of
    // both application logs and API responses.
    console.error('Email delivery failed.', {
      code: safeProviderCode(error),
    });
    throw new EmailDeliveryError();
  }
};

module.exports = mailer;
module.exports.EmailDeliveryError = EmailDeliveryError;
module.exports.closeMailTransporter = closeMailTransporter;
module.exports.getMailConfig = getMailConfig;
module.exports.getMailTransporter = getMailTransporter;
module.exports.validateMailData = validateMailData;
