'use strict';

const { recordDelivery } = require('./deliveryLog');

// bulksmsbd.net. Every outcome is HTTP 200, so only response_code means
// anything. POST, not GET, to keep the key out of proxy-logged URLs.

const API_BASE = process.env.SMS_API_BASE || 'https://bulksmsbd.net';
const API_KEY = process.env.SMS_API_KEY || '';
const SENDER_ID = process.env.SMS_SENDER_ID || '';

const TIMEOUT_MS = 20000;
const SUCCESS_CODE = 202;

const RESPONSE_CODES = Object.freeze({
  202: 'SMS submitted successfully',
  1001: 'Invalid number',
  1002: 'Sender ID is incorrect or disabled',
  1003: 'Required fields missing, or contact your system administrator',
  1005: 'Internal error at the gateway',
  1006: 'Balance validity not available',
  1007: 'Insufficient balance',
  1011: 'User ID not found for this API key',
  1012: 'Masking SMS must be sent in Bengali',
  1013: 'No gateway found for this sender ID and API key',
  1014: 'Sender type name not found for this sender and API key',
  1015: 'No valid gateway found for this sender ID and API key',
  1016: 'No active price info for this sender ID',
  1017: 'No price info for this sender ID',
  1018: 'The owner of this account is disabled',
  1019: 'The price of this account is disabled',
  1020: 'The parent of this account was not found',
  1021: 'The active price of this account’s parent was not found',
  1031: 'Account not verified, contact the provider',
  1032: 'This server’s IP is not whitelisted for the account',
});

/** Account problems. Retrying these changes nothing. */
const ACCOUNT_LEVEL_CODES = Object.freeze(
  new Set([1002, 1006, 1007, 1011, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020, 1021, 1031, 1032])
);

const describe = (code) => RESPONSE_CODES[code] || `Unrecognised gateway response (${code})`;

/**
 * To the 88XXXXXXXXXXX the gateway wants, or null if undeliverable.
 * Accepts 01712345678, +8801712345678, 8801712345678, with spaces or dashes.
 */
const normaliseNumber = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');

  let national;
  if (digits.length === 13 && digits.startsWith('880')) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('01')) national = digits;
  else if (digits.length === 10 && digits.startsWith('1')) national = `0${digits}`;
  else return null;

  // BD mobile prefixes are 013–019.
  if (!/^01[3-9]\d{8}$/.test(national)) return null;

  return `88${national}`;
};

const readJson = async (response) => {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    // An outage returns an HTML error page.
    return { response_code: null, error_message: body.slice(0, 200) };
  }
};

const post = async (path, params) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(new URL(path, API_BASE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
      signal: controller.signal,
    });
    return await readJson(response);
  } finally {
    clearTimeout(timer);
  }
};

/** One gateway call, no logging. Many numbers cost one request and one code. */
const dispatch = async (numbers, message) => {
  const startedAt = Date.now();

  if (!API_KEY) {
    return {
      ok: false,
      code: 'unconfigured',
      message: 'SMS_API_KEY is not set, so no message was sent.',
      permanent: true,
      durationMs: 0,
    };
  }

  try {
    const body = await post('/api/smsapi', {
      api_key: API_KEY,
      type: 'text',
      number: numbers.join(','),
      senderid: SENDER_ID,
      message,
    });

    const code = Number(body?.response_code);
    const ok = code === SUCCESS_CODE;

    return {
      ok,
      code: Number.isFinite(code) ? String(code) : 'unknown',
      message: ok ? describe(code) : body?.error_message || describe(code),
      permanent: ACCOUNT_LEVEL_CODES.has(code),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const timedOut = error.name === 'AbortError';
    return {
      ok: false,
      code: timedOut ? 'timeout' : 'network',
      message: timedOut
        ? `The gateway did not answer within ${TIMEOUT_MS / 1000} seconds.`
        : `Could not reach the gateway: ${error.message}`,
      permanent: false,
      durationMs: Date.now() - startedAt,
    };
  }
};

const sendSMS = async (number, message, { mode = 'custom' } = {}) => {
  const normalised = normaliseNumber(number);

  if (!normalised) {
    await recordDelivery({
      channel: 'sms',
      kind: 'single',
      mode,
      recipient: String(number ?? ''),
      subject: `${String(message ?? '').length} characters`,
      status: 'failed',
      providerCode: 'invalid-number',
      detail: 'Not a Bangladeshi mobile number the gateway can deliver to.',
      durationMs: 0,
    });

    return {
      ok: false,
      code: 'invalid-number',
      msg: 'That is not a Bangladeshi mobile number. Use 01XXXXXXXXX or 8801XXXXXXXXX.',
    };
  }

  const outcome = await dispatch([normalised], String(message ?? ''));

  await recordDelivery({
    channel: 'sms',
    kind: 'single',
    mode,
    recipient: normalised,
    // Length, not body. See the DeliveryLog model.
    subject: `${String(message ?? '').length} characters`,
    status: outcome.ok ? 'succeeded' : 'failed',
    providerCode: outcome.code,
    detail: outcome.message,
    durationMs: outcome.durationMs,
  });

  return { ok: outcome.ok, code: outcome.code, msg: outcome.message };
};

/**
 * One message to many numbers, one report row. The gateway answers once for the
 * whole batch, so per-recipient outcomes do not exist.
 */
const sendBulkSMS = async (numbers, message, { mode = 'bulk' } = {}) => {
  const normalised = [];
  const rejected = [];

  for (const number of numbers) {
    const valid = normaliseNumber(number);
    if (valid) normalised.push(valid);
    else rejected.push(String(number));
  }

  // Do not pay twice for a number pasted twice.
  const unique = [...new Set(normalised)];

  if (unique.length === 0) {
    return {
      ok: false,
      code: 'invalid-number',
      msg: 'None of those are Bangladeshi mobile numbers the gateway can deliver to.',
      sent: 0,
      failed: rejected.length,
      rejected,
    };
  }

  const outcome = await dispatch(unique, String(message ?? ''));

  const sent = outcome.ok ? unique.length : 0;
  const failed = (outcome.ok ? 0 : unique.length) + rejected.length;

  const notes = [outcome.message];
  if (rejected.length > 0) notes.push(`Skipped as invalid: ${rejected.join(', ')}`);

  await recordDelivery({
    channel: 'sms',
    kind: 'bulk',
    mode,
    recipient: `${unique.length + rejected.length} recipients`,
    subject: `${String(message ?? '').length} characters`,
    status: sent === 0 ? 'failed' : failed > 0 ? 'partial' : 'succeeded',
    providerCode: outcome.code,
    detail: notes.join(' · '),
    recipientCount: unique.length + rejected.length,
    succeededCount: sent,
    failedCount: failed,
    durationMs: outcome.durationMs,
  });

  return { ok: outcome.ok, code: outcome.code, msg: outcome.message, sent, failed, rejected };
};

/** Free to call and sends nothing. */
const getBalance = async () => {
  if (!API_KEY) return { ok: false, msg: 'SMS_API_KEY is not set.' };

  try {
    const body = await post('/api/getBalanceApi', { api_key: API_KEY });
    const code = Number(body?.response_code);

    if (code !== SUCCESS_CODE) {
      return { ok: false, msg: body?.error_message || describe(code) };
    }

    return { ok: true, balance: Number(body.balance), msg: 'Balance fetched.' };
  } catch (error) {
    return {
      ok: false,
      msg:
        error.name === 'AbortError'
          ? 'The gateway did not answer in time.'
          : `Could not reach the gateway: ${error.message}`,
    };
  }
};

module.exports = { sendSMS, sendBulkSMS, getBalance, normaliseNumber };
