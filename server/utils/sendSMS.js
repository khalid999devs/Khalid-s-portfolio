const https = require('node:https');
const { URL, URLSearchParams } = require('node:url');
const {
  ProviderCapacityError,
  ProviderDeadlineError,
  createProviderExecutor,
} = require('./providerExecution');

const DEFAULT_MAX_CONCURRENCY = 3;
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

const clientInputStatuses = new Set(['1002', '1003', '1004', '1005']);
const smsExecutor = createProviderExecutor({ providerName: 'SMS' });

class SmsDeliveryError extends Error {
  constructor(
    message = 'SMS delivery is temporarily unavailable.',
    {
      code = 'SMS_DELIVERY_FAILED',
      deliveryOutcome = 'unknown',
      statusCode = 502,
    } = {}
  ) {
    super(message);
    this.name = 'SmsDeliveryError';
    this.statusCode = statusCode;
    this.code = code;
    this.deliveryOutcome = deliveryOutcome;
    this.deliveryOutcomeAmbiguous = deliveryOutcome === 'unknown';
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
    throw configurationError(
      `${key} must be between ${minimum} and ${maximum}.`
    );
  }

  const value = Number(normalizedValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw configurationError(
      `${key} must be between ${minimum} and ${maximum}.`
    );
  }

  return value;
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

  const maxConcurrency = parseBoundedInteger(
    environment,
    'SMS_MAX_CONCURRENCY',
    { defaultValue: DEFAULT_MAX_CONCURRENCY, minimum: 1, maximum: 10 }
  );
  const timeoutMs = parseBoundedInteger(environment, 'SMS_TIMEOUT_MS', {
    defaultValue: DEFAULT_TIMEOUT_MS,
    minimum: 1_000,
    maximum: 30_000,
  });

  return { endpoint, maxConcurrency, password, timeoutMs, username };
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
    error.deliveryOutcome = 'not-attempted';
    error.deliveryOutcomeAmbiguous = false;
    throw error;
  }

  if (!content || content.length > 1_000) {
    const error = new Error('SMS message must be between 1 and 1000 characters.');
    error.code = 'SMS_INPUT_INVALID';
    error.statusCode = 400;
    error.deliveryOutcome = 'not-attempted';
    error.deliveryOutcomeAmbiguous = false;
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

const performRequest = (
  { body, options },
  request = https.request,
  {
    clearTimeoutFn = clearTimeout,
    setTimeoutFn = setTimeout,
    signal,
  } = {}
) =>
  new Promise((resolve, reject) => {
    let deadlineTimer;
    let req;
    let settled = false;

    const cleanup = () => {
      clearTimeoutFn(deadlineTimer);
      signal?.removeEventListener('abort', handleAbort);
    };

    const fail = (
      error,
      { destroyRequest = false, response } = {}
    ) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (response) {
        try {
          response.destroy();
        } catch (_error) {
          // The original bounded provider error remains authoritative.
        }
      }
      if (destroyRequest && req) {
        try {
          req.destroy(error);
        } catch (_error) {
          // The promise is still rejected below even if a fake/broken request
          // object cannot be destroyed cleanly.
        }
      }

      reject(error);
    };

    const succeed = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const timeoutError = () =>
      Object.assign(new Error('SMS provider request timed out.'), {
        code: 'SMS_PROVIDER_TIMEOUT',
        deliveryOutcome: 'unknown',
        deliveryOutcomeAmbiguous: true,
      });

    function handleAbort() {
      const error =
        signal.reason instanceof Error ? signal.reason : timeoutError();
      fail(error, { destroyRequest: true });
    }

    if (signal?.aborted) {
      fail(
        signal.reason instanceof Error ? signal.reason : timeoutError()
      );
      return;
    }

    signal?.addEventListener('abort', handleAbort, { once: true });
    deadlineTimer = setTimeoutFn(() => {
      fail(timeoutError(), { destroyRequest: true });
    }, options.timeout);

    try {
      req = request(options, (response) => {
        let responseBody = '';
        let responseBytes = 0;
        let responseEnded = false;
        const statusCode = response.statusCode;

        if (
          !Number.isInteger(statusCode) ||
          statusCode < 200 ||
          statusCode >= 300 ||
          response.headers?.location
        ) {
          fail(
            Object.assign(
              new Error('Unexpected SMS provider status.'),
              { code: 'SMS_PROVIDER_HTTP_ERROR' }
            ),
            { destroyRequest: true, response }
          );
          return;
        }

        try {
          response.setEncoding('utf8');
        } catch (error) {
          fail(error, { destroyRequest: true, response });
          return;
        }

        response.on('data', (chunk) => {
          if (settled) return;
          responseBytes += Buffer.byteLength(chunk);
          if (responseBytes > MAX_RESPONSE_BYTES) {
            fail(
              Object.assign(
                new Error('SMS provider response is too large.'),
                { code: 'SMS_PROVIDER_RESPONSE_TOO_LARGE' }
              ),
              { destroyRequest: true, response }
            );
            return;
          }
          responseBody += chunk;
        });
        response.on('end', () => {
          responseEnded = true;
          succeed(responseBody);
        });
        response.on('aborted', () => {
          fail(
            Object.assign(
              new Error('SMS provider response was aborted.'),
              { code: 'SMS_PROVIDER_RESPONSE_ABORTED' }
            ),
            { destroyRequest: true }
          );
        });
        response.on('close', () => {
          if (responseEnded || response.complete) return;
          fail(
            Object.assign(
              new Error('SMS provider response closed prematurely.'),
              { code: 'SMS_PROVIDER_RESPONSE_INCOMPLETE' }
            ),
            { destroyRequest: true }
          );
        });
        response.on('error', (error) => {
          fail(error, { destroyRequest: true });
        });
      });
    } catch (error) {
      fail(error);
      return;
    }

    if (settled) {
      try {
        req.destroy();
      } catch (_error) {
        // The response callback already settled the operation.
      }
      return;
    }

    try {
      if (
        typeof req?.on !== 'function' ||
        typeof req?.end !== 'function' ||
        typeof req?.destroy !== 'function'
      ) {
        throw new Error('SMS provider request object is invalid.');
      }
      req.on('timeout', () => {
        fail(timeoutError(), { destroyRequest: true });
      });
      req.on('error', fail);
      req.end(body);
    } catch (error) {
      fail(error, { destroyRequest: true });
    }
  });

const safeProviderCode = (error) => {
  const value = error?.code || 'UNKNOWN';
  return String(value).replace(/[^A-Z0-9_-]/gi, '').slice(0, 40) || 'UNKNOWN';
};

const toSmsDeliveryError = (error) => {
  if (error instanceof SmsDeliveryError) return error;

  if (error instanceof ProviderCapacityError) {
    return new SmsDeliveryError(undefined, {
      code: 'SMS_CAPACITY_EXCEEDED',
      deliveryOutcome: 'not-attempted',
      statusCode: 503,
    });
  }

  if (
    error instanceof ProviderDeadlineError ||
    error?.code === 'SMS_PROVIDER_TIMEOUT'
  ) {
    return new SmsDeliveryError(undefined, {
      code: 'SMS_DELIVERY_TIMEOUT',
      deliveryOutcome: 'unknown',
      statusCode: 504,
    });
  }

  return new SmsDeliveryError();
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
    throw new SmsDeliveryError(undefined, {
      code: 'SMS_PREPARATION_INVALID',
      deliveryOutcome: 'not-attempted',
    });
  }

  try {
    const body = await smsExecutor.execute(
      ({ signal }) => performRequest(request, https.request, { signal }),
      {
        capacity: config.maxConcurrency,
        timeoutMs: config.timeoutMs,
      }
    );
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
    throw toSmsDeliveryError(error);
  }
};

module.exports = sendSMS;
module.exports.SmsDeliveryError = SmsDeliveryError;
module.exports.buildSmsRequest = buildSmsRequest;
module.exports.getSmsConfig = getSmsConfig;
module.exports.parseProviderResponse = parseProviderResponse;
module.exports.performRequest = performRequest;
module.exports.toSmsDeliveryError = toSmsDeliveryError;
module.exports.validateSmsPayload = validateSmsPayload;
