const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const nodemailer = require('nodemailer');

const {
  buildSmsRequest,
  getSmsConfig,
  parseProviderResponse,
  performRequest,
  toSmsDeliveryError,
  validateSmsPayload,
} = require('../utils/sendSMS');
const {
  assertMailAccepted,
  closeMailTransporter,
  createDeliveryMessageId,
  createMailOptions,
  getMailConfig,
  getMailTransporter,
  sendMailWithAbort,
  toEmailDeliveryError,
  validateMailData,
} = require('../utils/sendMail');
const {
  ProviderCapacityError,
  ProviderDeadlineError,
} = require('../utils/providerExecution');

const smsEnvironment = {
  SMS_API_URL: 'https://sms.example.test/api.php',
  SMS_PASS: 'secret with symbols &?',
  SMS_TIMEOUT_MS: '5000',
  SMS_USERNAME: 'api-user',
};

test('SMS configuration rejects plaintext HTTP transport', () => {
  assert.throws(
    () =>
      getSmsConfig({
        ...smsEnvironment,
        SMS_API_URL: 'http://66.45.237.70/api.php',
      }),
    /must use HTTPS/
  );
});

test('SMS configuration rejects credentials and query data in its URL', () => {
  assert.throws(
    () =>
      getSmsConfig({
        ...smsEnvironment,
        SMS_API_URL: 'https://user:pass@sms.example.test/api.php',
      }),
    /cannot contain credentials/
  );

  assert.throws(
    () =>
      getSmsConfig({
        ...smsEnvironment,
        SMS_API_URL: 'https://sms.example.test/api.php?password=secret',
      }),
    /cannot contain credentials/
  );
});

test('SMS credentials and PII are sent in an encoded body, never the path', () => {
  const config = getSmsConfig(smsEnvironment);
  const request = buildSmsRequest(
    config,
    '8801700000000',
    'Hello & goodbye?'
  );
  const fields = new URLSearchParams(request.body);

  assert.equal(request.options.protocol, 'https:');
  assert.equal(request.options.rejectUnauthorized, true);
  assert.equal(request.options.minVersion, 'TLSv1.2');
  assert.equal(request.options.path, '/api.php');
  assert.equal(request.options.path.includes('?'), false);
  assert.equal(request.options.path.includes('secret'), false);
  assert.equal(fields.get('username'), smsEnvironment.SMS_USERNAME);
  assert.equal(fields.get('password'), smsEnvironment.SMS_PASS);
  assert.equal(fields.get('number'), '8801700000000');
  assert.equal(fields.get('message'), 'Hello & goodbye?');
  assert.equal(config.maxConcurrency, 3);
});

test('SMS payload validation rejects malformed recipients and oversized text', () => {
  assert.throws(
    () => validateSmsPayload('8801700000000\r\nInjected: value', 'hello'),
    /valid SMS recipient/
  );
  assert.throws(
    () => validateSmsPayload('8801700000000', 'x'.repeat(1_001)),
    /between 1 and 1000/
  );
});

test('SMS provider parsing exposes only a bounded status classification', () => {
  assert.deepEqual(parseProviderResponse('1101|message-id|extra'), {
    status: '1101',
    classification: 'accepted',
  });
  assert.deepEqual(parseProviderResponse('<html>provider error</html>'), {
    status: '<html>provider error</html>',
    classification: 'unknown-provider-response',
  });
});

test('SMS timeout and concurrency settings are strict and bounded', () => {
  assert.throws(
    () => getSmsConfig({ ...smsEnvironment, SMS_MAX_CONCURRENCY: '11' }),
    /SMS_MAX_CONCURRENCY must be between 1 and 10/
  );
  assert.throws(
    () => getSmsConfig({ ...smsEnvironment, SMS_TIMEOUT_MS: '1e4' }),
    /SMS_TIMEOUT_MS must be between 1000 and 30000/
  );
});

test('mail configuration always verifies TLS certificates', () => {
  const config = getMailConfig({
    MAIL_HOST: 'smtp.example.test',
    MAIL_PASS: 'smtp-secret',
    MAIL_PORT: '587',
    MAIL_SECURE: 'false',
    SERVER_EMAIL: 'sender@example.test',
  });

  assert.equal(config.transport.secure, false);
  assert.equal(config.transport.requireTLS, true);
  assert.equal(config.transport.pool, true);
  assert.equal(config.deliveryTimeoutMs, 45_000);
  assert.equal(config.transport.connectionTimeout, 10_000);
  assert.equal(config.transport.dnsTimeout, 10_000);
  assert.equal(config.transport.greetingTimeout, 10_000);
  assert.equal(config.transport.socketTimeout, 30_000);
  assert.equal(config.transport.maxConnections, 3);
  assert.equal(config.transport.maxMessages, 100);
  assert.equal(config.transport.maxRequeues, 0);
  assert.equal(config.transport.tls.rejectUnauthorized, true);
  assert.equal(config.transport.tls.minVersion, 'TLSv1.2');
});

test('mail timeout and pool settings are strictly bounded', () => {
  const environment = {
    MAIL_HOST: 'smtp.example.test',
    MAIL_PASS: 'smtp-secret',
    SERVER_EMAIL: 'sender@example.test',
  };

  assert.throws(
    () => getMailConfig({ ...environment, MAIL_SOCKET_TIMEOUT_MS: '0' }),
    /MAIL_SOCKET_TIMEOUT_MS must be an integer between 1000 and 120000/
  );
  assert.throws(
    () => getMailConfig({ ...environment, MAIL_POOL_MAX_CONNECTIONS: '11' }),
    /MAIL_POOL_MAX_CONNECTIONS must be an integer between 1 and 10/
  );
  assert.throws(
    () => getMailConfig({ ...environment, MAIL_DELIVERY_TIMEOUT_MS: '999' }),
    /MAIL_DELIVERY_TIMEOUT_MS must be an integer between 1000 and 120000/
  );
  assert.throws(
    () => getMailConfig({ ...environment, MAIL_DNS_TIMEOUT_MS: '0' }),
    /MAIL_DNS_TIMEOUT_MS must be an integer between 1000 and 60000/
  );
});

test('mail transport reuses a healthy pool and replaces it after credential rotation', () => {
  const originalCreateTransport = nodemailer.createTransport;
  const transports = [];
  nodemailer.createTransport = (options) => {
    const transporter = {
      closeCount: 0,
      options,
      close() {
        this.closeCount += 1;
      },
    };
    transports.push(transporter);
    return transporter;
  };

  const environment = {
    MAIL_HOST: 'smtp.example.test',
    MAIL_PASS: 'first-secret',
    SERVER_EMAIL: 'sender@example.test',
  };

  try {
    closeMailTransporter();
    const first = getMailTransporter(getMailConfig(environment).transport);
    const reused = getMailTransporter(getMailConfig(environment).transport);
    const rotated = getMailTransporter(
      getMailConfig({ ...environment, MAIL_PASS: 'rotated-secret' }).transport
    );

    assert.equal(first, reused);
    assert.notEqual(rotated, first);
    assert.equal(transports.length, 2);
    assert.equal(first.closeCount, 1);

    closeMailTransporter();
    assert.equal(rotated.closeCount, 1);
  } finally {
    closeMailTransporter();
    nodemailer.createTransport = originalCreateTransport;
  }
});

test('mail abort closes its pool but tracks the underlying send until settlement', async () => {
  const originalCreateTransport = nodemailer.createTransport;
  let closeCount = 0;
  let settleSend;
  const transporter = {
    close() {
      closeCount += 1;
    },
    sendMail() {
      return new Promise((resolve) => {
        settleSend = resolve;
      });
    },
  };
  nodemailer.createTransport = () => transporter;
  const controller = new AbortController();

  try {
    closeMailTransporter();
    const cached = getMailTransporter(
      getMailConfig({
        MAIL_HOST: 'smtp.example.test',
        MAIL_PASS: 'smtp-secret',
        SERVER_EMAIL: 'sender@example.test',
      }).transport
    );
    const operation = sendMailWithAbort(
      cached,
      { to: 'recipient@example.test' },
      controller.signal
    );
    const deadlineError = new ProviderDeadlineError('Email', 5_000);

    controller.abort(deadlineError);
    assert.equal(closeCount, 1);

    settleSend({
      accepted: ['recipient@example.test'],
      rejected: [],
    });
    assert.deepEqual(await operation, {
      accepted: ['recipient@example.test'],
      rejected: [],
    });
  } finally {
    closeMailTransporter();
    nodemailer.createTransport = originalCreateTransport;
  }
});

test('mail credentials are evaluated at call time', () => {
  const first = getMailConfig({
    MAIL_HOST: 'smtp.example.test',
    MAIL_PASS: 'first-secret',
    SERVER_EMAIL: 'sender@example.test',
  });
  const second = getMailConfig({
    MAIL_HOST: 'smtp.example.test',
    MAIL_PASS: 'rotated-secret',
    SERVER_EMAIL: 'sender@example.test',
  });

  assert.equal(first.transport.auth.pass, 'first-secret');
  assert.equal(second.transport.auth.pass, 'rotated-secret');
});

test('mail recipient validation rejects invalid addresses', () => {
  assert.throws(
    () => validateMailData({ client: { email: 'not-an-email' } }),
    (error) =>
      /valid recipient email/u.test(error.message) &&
      error.deliveryOutcome === 'not-attempted' &&
      error.deliveryOutcomeAmbiguous === false
  );
});

test('contact delivery attempts produce a strict deterministic Message-ID', () => {
  const attemptId = '123e4567-e89b-42d3-a456-426614174000';
  const config = getMailConfig({
    MAIL_HOST: 'smtp.example.test',
    MAIL_PASS: 'smtp-secret',
    SERVER_EMAIL: 'sender@example.test',
  });
  const data = {
    client: {
      email: 'recipient@example.test',
      fullName: 'Recipient',
    },
    delivery: { attemptId },
    info: { body: 'Reply body' },
  };
  const message = createMailOptions({
    config,
    data,
    mode: 'contact',
    recipient: data.client.email,
  });

  assert.equal(message.messageId, `<${attemptId}@portfolio.local>`);
  assert.equal(
    createDeliveryMessageId({
      attemptId: attemptId.toUpperCase(),
    }),
    `<${attemptId}@portfolio.local>`
  );
  assert.throws(
    () =>
      createDeliveryMessageId({
        attemptId: `${attemptId}\r\nBcc: hidden@example.test`,
      }),
    /canonical UUID/
  );
  assert.throws(
    () => createDeliveryMessageId({ attemptId: 'not-a-uuid' }),
    /canonical UUID/
  );
});

test('mail delivery requires an explicitly accepted recipient', () => {
  assert.doesNotThrow(() =>
    assertMailAccepted({
      accepted: ['recipient@example.test'],
      rejected: [],
    })
  );
  assert.throws(
    () => assertMailAccepted({ accepted: [], rejected: [] }),
    /not accepted/
  );
  assert.throws(
    () =>
      assertMailAccepted({
        accepted: ['recipient@example.test'],
        rejected: ['recipient@example.test'],
      }),
    /not accepted/
  );
});

test('provider deadline mappings preserve ambiguous delivery outcomes', () => {
  const providerError = new ProviderDeadlineError('Test', 5_000);
  const emailError = toEmailDeliveryError(providerError);
  const smsError = toSmsDeliveryError(providerError);

  assert.equal(emailError.statusCode, 504);
  assert.equal(emailError.code, 'EMAIL_DELIVERY_TIMEOUT');
  assert.equal(emailError.deliveryOutcome, 'unknown');
  assert.equal(emailError.deliveryOutcomeAmbiguous, true);
  assert.equal(smsError.statusCode, 504);
  assert.equal(smsError.code, 'SMS_DELIVERY_TIMEOUT');
  assert.equal(smsError.deliveryOutcome, 'unknown');
  assert.equal(smsError.deliveryOutcomeAmbiguous, true);
});

test('provider capacity failures are classified as not attempted', () => {
  const providerError = new ProviderCapacityError('Email');
  const emailError = toEmailDeliveryError(providerError);
  const smsError = toSmsDeliveryError(providerError);

  assert.equal(emailError.statusCode, 503);
  assert.equal(emailError.deliveryOutcome, 'not-attempted');
  assert.equal(emailError.deliveryOutcomeAmbiguous, false);
  assert.equal(smsError.statusCode, 503);
  assert.equal(smsError.deliveryOutcome, 'not-attempted');
  assert.equal(smsError.deliveryOutcomeAmbiguous, false);
});

const createPendingRequest = () => {
  const request = new EventEmitter();
  request.destroyedWith = undefined;
  request.destroy = (error) => {
    request.destroyedWith = error;
    if (error) request.emit('error', error);
  };
  request.end = () => {};
  return request;
};

test('SMS requests enforce an absolute deadline before any response', async () => {
  const request = createPendingRequest();
  let invokeDeadline;
  const delivery = performRequest(
    { body: 'message=hello', options: { timeout: 5_000 } },
    () => request,
    {
      clearTimeoutFn() {},
      setTimeoutFn(callback) {
        invokeDeadline = callback;
        return 1;
      },
    }
  );

  invokeDeadline();

  await assert.rejects(
    delivery,
    (error) =>
      error.code === 'SMS_PROVIDER_TIMEOUT' &&
      error.deliveryOutcomeAmbiguous === true
  );
  assert.equal(request.destroyedWith.code, 'SMS_PROVIDER_TIMEOUT');
});

test('SMS requests destroy the underlying request when externally aborted', async () => {
  const request = createPendingRequest();
  const controller = new AbortController();
  const deadlineError = new ProviderDeadlineError('SMS', 5_000);
  const delivery = performRequest(
    { body: 'message=hello', options: { timeout: 5_000 } },
    () => request,
    {
      clearTimeoutFn() {},
      setTimeoutFn() {
        return 1;
      },
      signal: controller.signal,
    }
  );

  controller.abort(deadlineError);

  await assert.rejects(delivery, (error) => error === deadlineError);
  assert.equal(request.destroyedWith, deadlineError);
});

test('SMS requests reject aborted and prematurely closed responses', async () => {
  for (const [eventName, expectedCode] of [
    ['aborted', 'SMS_PROVIDER_RESPONSE_ABORTED'],
    ['close', 'SMS_PROVIDER_RESPONSE_INCOMPLETE'],
  ]) {
    const request = createPendingRequest();
    const response = new EventEmitter();
    response.complete = false;
    response.destroy = () => {};
    response.headers = {};
    response.setEncoding = () => {};
    response.statusCode = 200;
    let provideResponse;
    const delivery = performRequest(
      { body: 'message=hello', options: { timeout: 5_000 } },
      (_options, callback) => {
        provideResponse = () => callback(response);
        return request;
      },
      {
        clearTimeoutFn() {},
        setTimeoutFn() {
          return 1;
        },
      }
    );

    provideResponse();
    response.emit(eventName);

    await assert.rejects(
      delivery,
      (error) => error.code === expectedCode
    );
  }
});
