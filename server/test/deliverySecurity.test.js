const assert = require('node:assert/strict');
const test = require('node:test');
const nodemailer = require('nodemailer');

const {
  buildSmsRequest,
  getSmsConfig,
  parseProviderResponse,
  validateSmsPayload,
} = require('../utils/sendSMS');
const {
  closeMailTransporter,
  getMailConfig,
  getMailTransporter,
  validateMailData,
} = require('../utils/sendMail');

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
  assert.equal(config.transport.connectionTimeout, 10_000);
  assert.equal(config.transport.greetingTimeout, 10_000);
  assert.equal(config.transport.socketTimeout, 30_000);
  assert.equal(config.transport.maxConnections, 3);
  assert.equal(config.transport.maxMessages, 100);
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
    /valid recipient email/
  );
});
