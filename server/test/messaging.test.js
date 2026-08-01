'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

const { normaliseNumber } = require('../utils/sendSMS');
const { parseEmails, parseNumbers } = require('../utils/recipients');

// These decide who gets a message and who is charged for it, and both fail
// silently when wrong. No database, no network.

test('accepts the number formats people actually type', () => {
  const accepted = {
    '01712345678': '8801712345678',
    '+8801712345678': '8801712345678',
    '8801712345678': '8801712345678',
    '1712345678': '8801712345678',
    '017 1234 5678': '8801712345678',
    '017-1234-5678': '8801712345678',
    '(017) 1234-5678': '8801712345678',
  };

  for (const [input, expected] of Object.entries(accepted)) {
    assert.equal(normaliseNumber(input), expected, `${input} should normalise`);
  }
});

test('every Bangladeshi mobile prefix normalises', () => {
  for (let prefix = 3; prefix <= 9; prefix += 1) {
    const number = `01${prefix}12345678`;
    assert.equal(normaliseNumber(number), `8801${prefix}12345678`);
  }
});

test('rejects what the gateway cannot deliver to', () => {
  const rejected = [
    '01212345678', // unallocated prefix
    '01012345678',
    '0171234567', // one digit short
    '017123456789', // one digit long
    '+14155550100', // not a Bangladeshi number
    'not a number',
    '',
    null,
    undefined,
  ];

  for (const input of rejected) {
    assert.equal(normaliseNumber(input), null, `${input} should be rejected`);
  }
});

test('splits recipients on commas, spaces, semicolons and new lines', () => {
  const { valid, invalid } = parseEmails(
    'one@example.com, two@example.com three@example.com;four@example.com\nfive@example.com'
  );

  assert.deepEqual(valid, [
    'one@example.com',
    'two@example.com',
    'three@example.com',
    'four@example.com',
    'five@example.com',
  ]);
  assert.deepEqual(invalid, []);
});

test('reports bad addresses instead of dropping them', () => {
  const { valid, invalid } = parseEmails('good@example.com, not-an-address, also@bad');

  assert.deepEqual(valid, ['good@example.com']);
  assert.deepEqual(invalid, ['not-an-address', 'also@bad']);
});

test('removes duplicates regardless of case', () => {
  const { valid, duplicates } = parseEmails('a@example.com, A@Example.com, b@example.com');

  assert.deepEqual(valid, ['a@example.com', 'b@example.com']);
  assert.equal(duplicates, 1);
});

test('trailing separators and blank entries do not become recipients', () => {
  const { valid, invalid } = parseEmails('  a@example.com ,, b@example.com ,  \n ');

  assert.deepEqual(valid, ['a@example.com', 'b@example.com']);
  assert.deepEqual(invalid, []);
});

test('numbers are split but not validated here', () => {
  // Validation belongs to the gateway client; two copies would drift.
  assert.deepEqual(parseNumbers('01712345678, 01812345678\n01912345678'), [
    '01712345678',
    '01812345678',
    '01912345678',
  ]);
});
