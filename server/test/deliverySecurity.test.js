const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildSmsRequest,
  getSmsConfig,
  parseProviderResponse,
  validateSmsPayload,
} = require('../utils/sendSMS');
const {
  getMailConfig,
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
  assert.equal(config.transport.tls.rejectUnauthorized, true);
  assert.equal(config.transport.tls.minVersion, 'TLSv1.2');
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
