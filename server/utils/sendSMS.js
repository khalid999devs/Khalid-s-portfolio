const https = require('node:https');
const { URL, URLSearchParams } = require('node:url');

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 4_096;

const providerMessages = {
  1000: 'provider-authentication-failed',
  1002: 'invalid-recipient',
  1003: 'invalid-message',
  1004: 'invalid-recipient',
  1005: 'invalid-recipient',
  1006: 'provider-balance-unavailable',
  1009: 'provider-account-inactive',
  1010: 'provider-limit-exceeded',
  1101: 'accepted',
};

const clientInputStatuses = new Set(['1002', '1003', '1004', '1005', '1010']);

class SmsDeliveryError extends Error {
  constructor(message = 'SMS delivery is temporarily unavailable.') {
    super(message);
    this.name = 'SmsDeliveryError';
    this.statusCode = 502;
    this.code = 'SMS_DELIVERY_FAILED';
  }
}

const configurationError = (message) => {
  const error = new Error(message);
  error.code = 'SMS_CONFIGURATION_INVALID';
  return error;
};

const requireConfigValue = (environment, key) => {
  const value = environment[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw configurationError(`${key} is required for SMS delivery.`);
  }

  return value.trim();
};

const getSmsConfig = (environment = process.env) => {
  const rawEndpoint = requireConfigValue(environment, 'SMS_API_URL');
  const username = requireConfigValue(environment, 'SMS_USERNAME');
  const password = requireConfigValue(environment, 'SMS_PASS');
  let endpoint;

  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw configurationError('SMS_API_URL must be a valid absolute URL.');
  }

  if (endpoint.protocol !== 'https:') {
    throw configurationError('SMS_API_URL must use HTTPS.');
  }

  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw configurationError(
      'SMS_API_URL cannot contain credentials, query parameters, or a fragment.'
    );
  }

  const timeoutMs = environment.SMS_TIMEOUT_MS
    ? Number(environment.SMS_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw configurationError(
      'SMS_TIMEOUT_MS must be between 1000 and 30000 milliseconds.'
    );
  }

  return { endpoint, password, timeoutMs, username };
};

const validateSmsPayload = (numbers, message) => {
  const recipients = String(numbers ?? '').trim();
  const content = typeof message === 'string' ? message.trim() : '';

  if (
    !recipients ||
    recipients.length > 500 ||
    !/^\+?\d+(,\+?\d+)*$/.test(recipients)
  ) {
    const error = new Error('A valid SMS recipient is required.');
    error.code = 'SMS_INPUT_INVALID';
    error.statusCode = 400;
    throw error;
  }

  if (!content || content.length > 1_000) {
    const error = new Error('SMS message must be between 1 and 1000 characters.');
    error.code = 'SMS_INPUT_INVALID';
    error.statusCode = 400;
    throw error;
  }

  return { content, recipients };
};

const buildSmsRequest = (config, numbers, message) => {
  const { content, recipients } = validateSmsPayload(numbers, message);
  const body = new URLSearchParams({
    username: config.username,
    password: config.password,
    number: recipients,
    message: content,
  }).toString();

  return {
    body,
    options: {
      protocol: 'https:',
      hostname: config.endpoint.hostname,
      port: config.endpoint.port || 443,
      path: config.endpoint.pathname,
      method: 'POST',
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      headers: {
        Accept: 'text/plain',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: config.timeoutMs,
    },
  };
};

const parseProviderResponse = (body) => {
  const status = String(body || '').trim().split('|', 1)[0];
  return {
    status,
    classification: providerMessages[status] || 'unknown-provider-response',
  };
};

const performRequest = ({ body, options }, request = https.request) =>
  new Promise((resolve, reject) => {
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const req = request(options, (response) => {
      let responseBody = '';
      let responseBytes = 0;

      if (
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        response.headers.location
      ) {
        response.resume();
        fail(Object.assign(new Error('Unexpected SMS provider status.'), {
          code: 'SMS_PROVIDER_HTTP_ERROR',
        }));
        return;
      }

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        responseBytes += Buffer.byteLength(chunk);
        if (responseBytes > MAX_RESPONSE_BYTES) {
          response.destroy();
          fail(Object.assign(new Error('SMS provider response is too large.'), {
            code: 'SMS_PROVIDER_RESPONSE_TOO_LARGE',
          }));
          return;
        }
        responseBody += chunk;
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        resolve(responseBody);
      });
      response.on('error', fail);
    });

    req.on('timeout', () => {
      req.destroy(
        Object.assign(new Error('SMS provider request timed out.'), {
          code: 'SMS_PROVIDER_TIMEOUT',
        })
      );
    });
    req.on('error', fail);
    req.end(body);
  });

const safeProviderCode = (error) => {
  const value = error?.code || 'UNKNOWN';
  return String(value).replace(/[^A-Z0-9_-]/gi, '').slice(0, 40) || 'UNKNOWN';
};

const sendSMS = async (numbers, message) => {
  let config;
  let request;

  try {
    config = getSmsConfig();
    request = buildSmsRequest(config, numbers, message);
  } catch (error) {
    if (error.statusCode === 400) throw error;

    console.error('SMS delivery configuration is invalid.', {
      code: safeProviderCode(error),
    });
    throw new SmsDeliveryError();
  }

  try {
    const body = await performRequest(request);
    const result = parseProviderResponse(body);

    if (result.status === '1101') {
      return { type: result.status, msg: 'SMS accepted for delivery.' };
    }

    console.warn('SMS provider rejected a request.', {
      status: result.status.replace(/[^0-9]/g, '').slice(0, 8) || 'unknown',
    });

    if (clientInputStatuses.has(result.status)) {
      return {
        type: result.status,
        msg: 'SMS was rejected. Check the recipient and message.',
      };
    }

    throw Object.assign(new Error('SMS provider rejected the request.'), {
      code: 'SMS_PROVIDER_REJECTED',
    });
  } catch (error) {
    if (error instanceof SmsDeliveryError) throw error;

    console.error('SMS delivery failed.', {
      code: safeProviderCode(error),
    });
    throw new SmsDeliveryError();
  }
};

module.exports = sendSMS;
module.exports.SmsDeliveryError = SmsDeliveryError;
module.exports.buildSmsRequest = buildSmsRequest;
module.exports.getSmsConfig = getSmsConfig;
module.exports.parseProviderResponse = parseProviderResponse;
module.exports.performRequest = performRequest;
module.exports.validateSmsPayload = validateSmsPayload;
