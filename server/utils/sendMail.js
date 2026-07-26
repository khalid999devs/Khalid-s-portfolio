const nodemailer = require('nodemailer');

const { htmlCreator } = require('./htmlTemplates');
const { EmailCover } = require('./TemplateCover');
const {
  ProviderCapacityError,
  ProviderDeadlineError,
  createProviderExecutor,
} = require('./providerExecution');

const DEFAULT_SMTP_PORT = 465;
const DEFAULT_FROM_NAME = 'Khalid Ahammed';
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_DELIVERY_TIMEOUT_MS = 45_000;
const DEFAULT_DNS_TIMEOUT_MS = 10_000;
const DEFAULT_GREETING_TIMEOUT_MS = 10_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 30_000;
const DEFAULT_POOL_MAX_CONNECTIONS = 3;
const DEFAULT_POOL_MAX_MESSAGES = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELIVERY_ATTEMPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

let cachedTransporter;
let cachedTransportOptions;
const mailExecutor = createProviderExecutor({ providerName: 'Email' });

class EmailDeliveryError extends Error {
  constructor(
    message = 'Email delivery is temporarily unavailable.',
    {
      code = 'EMAIL_DELIVERY_FAILED',
      deliveryOutcome = 'unknown',
      statusCode = 502,
    } = {}
  ) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.statusCode = statusCode;
    this.code = code;
    this.deliveryOutcome = deliveryOutcome;
    this.deliveryOutcomeAmbiguous = deliveryOutcome === 'unknown';
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
  const port = parseBoundedInteger(environment, 'MAIL_PORT', {
    defaultValue: DEFAULT_SMTP_PORT,
    minimum: 1,
    maximum: 65_535,
  });

  if (!EMAIL_PATTERN.test(user) || user.length > 254) {
    const error = new Error('SERVER_EMAIL must be a valid email address.');
    error.code = 'EMAIL_CONFIGURATION_INVALID';
    throw error;
  }

  const secure = parseBoolean(environment.MAIL_SECURE, port === 465);
  const fromName =
    environment.MAIL_FROM_NAME?.trim() || DEFAULT_FROM_NAME;
  const deliveryTimeoutMs = parseBoundedInteger(
    environment,
    'MAIL_DELIVERY_TIMEOUT_MS',
    {
      defaultValue: DEFAULT_DELIVERY_TIMEOUT_MS,
      minimum: 1_000,
      maximum: 120_000,
    }
  );
  const connectionTimeout = parseBoundedInteger(
    environment,
    'MAIL_CONNECTION_TIMEOUT_MS',
    { defaultValue: DEFAULT_CONNECTION_TIMEOUT_MS, minimum: 1_000, maximum: 60_000 }
  );
  const dnsTimeout = parseBoundedInteger(
    environment,
    'MAIL_DNS_TIMEOUT_MS',
    { defaultValue: DEFAULT_DNS_TIMEOUT_MS, minimum: 1_000, maximum: 60_000 }
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
    deliveryTimeoutMs,
    fromName,
    fromAddress: user,
    transport: {
      pool: true,
      host,
      port,
      secure,
      requireTLS: !secure,
      connectionTimeout,
      dnsTimeout,
      greetingTimeout,
      socketTimeout,
      maxConnections,
      maxMessages,
      // Automatic SMTP replay can duplicate a message when a connection dies
      // after remote acceptance but before the client sees the final response.
      maxRequeues: 0,
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
  left.dnsTimeout === right.dnsTimeout &&
  left.greetingTimeout === right.greetingTimeout &&
  left.socketTimeout === right.socketTimeout &&
  left.maxConnections === right.maxConnections &&
  left.maxMessages === right.maxMessages &&
  left.maxRequeues === right.maxRequeues &&
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
    error.deliveryOutcome = 'not-attempted';
    error.deliveryOutcomeAmbiguous = false;
    throw error;
  }

  return normalizedRecipient;
};

const createDeliveryMessageId = (delivery) => {
  if (delivery === undefined) return undefined;

  const attemptId = delivery?.attemptId;
  if (
    typeof delivery !== 'object' ||
    delivery === null ||
    typeof attemptId !== 'string' ||
    !DELIVERY_ATTEMPT_ID_PATTERN.test(attemptId)
  ) {
    const error = new Error(
      'Email delivery attemptId must be a canonical UUID.'
    );
    error.code = 'EMAIL_DELIVERY_ID_INVALID';
    throw error;
  }

  return `<${attemptId.toLowerCase()}@portfolio.local>`;
};

const createMailOptions = ({ config, data, mode, recipient }) => {
  const { subject, body, text } = htmlCreator(mode, data);
  const messageId = createDeliveryMessageId(data?.delivery);

  return {
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
    ...(messageId ? { messageId } : {}),
  };
};

const assertMailAccepted = (delivery) => {
  if (
    !Array.isArray(delivery?.accepted) ||
    delivery.accepted.length === 0 ||
    (Array.isArray(delivery.rejected) && delivery.rejected.length > 0)
  ) {
    throw Object.assign(new Error('SMTP recipient was not accepted.'), {
      code: 'SMTP_RECIPIENT_REJECTED',
    });
  }
};

const sendMailWithAbort = async (transporter, message, signal) => {
  const abortTransport = () => {
    try {
      discardMailTransporter(transporter);
    } catch (_error) {
      // The deadline error remains authoritative. A close failure must not
      // turn a bounded caller response into an uncaught abort-listener error.
    }
  };

  if (signal.aborted) {
    abortTransport();
    throw signal.reason;
  }

  signal.addEventListener('abort', abortTransport, { once: true });
  try {
    return await transporter.sendMail(message);
  } finally {
    signal.removeEventListener('abort', abortTransport);
  }
};

const toEmailDeliveryError = (error) => {
  if (error instanceof EmailDeliveryError) return error;

  if (error instanceof ProviderCapacityError) {
    return new EmailDeliveryError(undefined, {
      code: 'EMAIL_CAPACITY_EXCEEDED',
      deliveryOutcome: 'not-attempted',
      statusCode: 503,
    });
  }

  if (error instanceof ProviderDeadlineError) {
    return new EmailDeliveryError(undefined, {
      code: 'EMAIL_DELIVERY_TIMEOUT',
      deliveryOutcome: 'unknown',
      statusCode: 504,
    });
  }

  if (error?.code === 'SMTP_RECIPIENT_REJECTED') {
    return new EmailDeliveryError(undefined, {
      code: 'EMAIL_RECIPIENT_REJECTED',
      deliveryOutcome: 'rejected',
    });
  }

  return new EmailDeliveryError();
};

const safeProviderCode = (error) => {
  const value = error?.code || error?.responseCode || 'UNKNOWN';
  return String(value).replace(/[^A-Z0-9_-]/gi, '').slice(0, 40) || 'UNKNOWN';
};

const mailer = async (data, mode) => {
  let config;
  let message;
  let recipient;

  try {
    config = getMailConfig();
    recipient = validateMailData(data);
    message = createMailOptions({ config, data, mode, recipient });
  } catch (error) {
    if (error.statusCode === 400) throw error;

    console.error('Email delivery preparation is invalid.', {
      code: safeProviderCode(error),
    });
    throw new EmailDeliveryError(undefined, {
      code: 'EMAIL_PREPARATION_INVALID',
      deliveryOutcome: 'not-attempted',
    });
  }

  let transporter;

  try {
    transporter = getMailTransporter(config.transport);
    const delivery = await mailExecutor.execute(
      ({ signal }) => sendMailWithAbort(transporter, message, signal),
      {
        capacity: config.transport.maxConnections,
        timeoutMs: config.deliveryTimeoutMs,
      }
    );

    assertMailAccepted(delivery);

    return {
      messageId: delivery.messageId || message.messageId,
      status: 'accepted',
    };
  } catch (error) {
    if (!(error instanceof ProviderCapacityError)) {
      // A failed pooled connection is discarded so the next attempt starts
      // from a clean socket instead of inheriting a broken SMTP session.
      try {
        discardMailTransporter(transporter);
      } catch (closeError) {
        console.error('Unable to discard failed email transport.', {
          code: safeProviderCode(closeError),
        });
      }
    }
    // Log only a bounded provider code. SMTP responses can contain recipient
    // addresses and infrastructure details, so raw provider errors stay out of
    // both application logs and API responses.
    console.error('Email delivery failed.', {
      code: safeProviderCode(error),
    });
    throw toEmailDeliveryError(error);
  }
};

module.exports = mailer;
module.exports.EmailDeliveryError = EmailDeliveryError;
module.exports.assertMailAccepted = assertMailAccepted;
module.exports.closeMailTransporter = closeMailTransporter;
module.exports.createDeliveryMessageId = createDeliveryMessageId;
module.exports.createMailOptions = createMailOptions;
module.exports.getMailConfig = getMailConfig;
module.exports.getMailTransporter = getMailTransporter;
module.exports.sendMailWithAbort = sendMailWithAbort;
module.exports.toEmailDeliveryError = toEmailDeliveryError;
module.exports.validateMailData = validateMailData;
