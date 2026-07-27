'use strict';

const https = require('follow-redirects').https;
const http = require('follow-redirects').http;
const { recordDelivery } = require('./deliveryLog');

/**
 * SMS gateway client.
 *
 * Two things worth knowing about this provider, because neither is ideal and
 * both are properties of their API rather than choices made here:
 *
 * 1. Credentials go in the query string. Query strings are logged by proxies
 *    and reverse proxies as a matter of course, so the gateway password ends up
 *    in access logs outside our control. The provider offers no header or body
 *    authentication.
 * 2. The documented endpoint is plain HTTP to a bare IP address, which means
 *    those credentials and the message body cross the network in the clear.
 *
 * `SMS_API_BASE` lets the host be pointed at an HTTPS endpoint the moment the
 * provider supports one, and the scheme is chosen from it. The default keeps
 * the existing behaviour so nothing breaks, but the insecure path is now a
 * visible default rather than a hardcoded assumption.
 */

const userName = process.env.SMS_USERNAME;
const password = process.env.SMS_PASS;
const API_BASE = process.env.SMS_API_BASE || 'http://66.45.237.70';

const resType = {
  1000: 'Invalid user or Password',
  1002: 'Empty Number',
  1003: 'Invalid message or empty message',
  1004: 'Invalid number',
  1005: 'All Number is Invalid',
  1006: 'insufficient Balance',
  1009: 'Inactive Account',
  1010: 'Max number limit exceeded',
  1101: 'Success',
};

const SUCCESS_CODE = '1101';

const sendSMS = async (numbers, message) => {
  const base = new URL(API_BASE);
  const client = base.protocol === 'https:' ? https : http;

  const path = `/api.php?${new URLSearchParams({
    username: userName ?? '',
    password: password ?? '',
    number: String(numbers ?? ''),
    message: String(message ?? ''),
  })}`;

  const options = {
    method: 'POST',
    hostname: base.hostname,
    port: base.port || undefined,
    path,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    maxRedirects: 20,
  };

  const startedAt = Date.now();

  const outcome = await new Promise((resolve) => {
    const req = client.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));

      res.on('end', () => {
        const code = Buffer.concat(chunks).toString().split('|')[0]?.trim();
        resolve({
          type: code,
          msg: resType[code] || 'Unknown gateway response',
          ok: code === SUCCESS_CODE,
        });
      });

      res.on('error', (error) => {
        resolve({ type: 'error', msg: 'Error sending sms', ok: false, detail: error.message });
      });
    });

    // Without this a network level failure never settles the promise and the
    // request hangs until the client gives up.
    req.on('error', (error) => {
      resolve({ type: 'error', msg: 'Error sending sms', ok: false, detail: error.message });
    });

    req.end();
  });

  await recordDelivery({
    channel: 'sms',
    mode: 'gateway',
    recipient: String(numbers ?? ''),
    // The message body is not stored. The subject line records its size so a
    // truncation problem is still diagnosable without keeping the content.
    subject: `${String(message ?? '').length} characters`,
    status: outcome.ok ? 'succeeded' : 'failed',
    providerCode: outcome.type,
    detail: outcome.detail ? `${outcome.msg}: ${outcome.detail}` : outcome.msg,
    durationMs: Date.now() - startedAt,
  });

  return { type: outcome.type, msg: outcome.msg };
};

module.exports = sendSMS;
