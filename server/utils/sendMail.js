const nodemailer = require('nodemailer');

const { htmlCreator } = require('./htmlTemplates');
const { EmailCover } = require('./TemplateCover');

const DEFAULT_SMTP_PORT = 465;
const DEFAULT_FROM_NAME = 'Khalid Ahammed';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  return {
    fromName,
    fromAddress: user,
    transport: {
      host,
      port,
      secure,
      requireTLS: !secure,
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
    transporter = nodemailer.createTransport(config.transport);
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
    // Log only a bounded provider code. SMTP responses can contain recipient
    // addresses and infrastructure details, so raw provider errors stay out of
    // both application logs and API responses.
    console.error('Email delivery failed.', {
      code: safeProviderCode(error),
    });
    throw new EmailDeliveryError();
  } finally {
    if (typeof transporter?.close === 'function') transporter.close();
  }
};

module.exports = mailer;
module.exports.EmailDeliveryError = EmailDeliveryError;
module.exports.getMailConfig = getMailConfig;
module.exports.validateMailData = validateMailData;
