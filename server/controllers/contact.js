'use strict';

const { BadRequestError } = require('../errors');
const { mailer, mailerBulk } = require('../utils/sendMail');
const { sendSMS, sendBulkSMS, getBalance } = require('../utils/sendSMS');
const { parseEmails, parseNumbers, MAXIMUM_RECIPIENTS } = require('../utils/recipients');

// Single and bulk are separate routes: a batch is usually partly delivered, and
// one shape cannot report both honestly.

const sendEmailToClient = async (req, res) => {
  const mode = req.params.mode;
  const { text, html, template, subject, email, name, ctaLabel, ctaUrl } = req.body ?? {};

  if (!text && !html) throw new BadRequestError('The message body is empty.');
  if (!email) throw new BadRequestError('A recipient address is required.');

  try {
    await mailer(
      {
        info: { subject, body: text, html, template, cta: { label: ctaLabel, url: ctaUrl } },
        client: { fullName: name, email },
      },
      mode || 'custom'
    );
    res.json({ succeed: true, msg: 'Email sent.', text });
  } catch (error) {
    throw new BadRequestError(error.message);
  }
};

/** Bad addresses stop the request rather than being skipped silently. */
const sendBulkEmail = async (req, res) => {
  const { text, html, template, subject, recipients, ctaLabel, ctaUrl } = req.body ?? {};

  if (!text && !html) throw new BadRequestError('The message body is empty.');
  if (!subject) throw new BadRequestError('A subject is required.');

  const { valid, invalid, duplicates } = parseEmails(recipients);

  if (invalid.length > 0) {
    throw new BadRequestError(
      `${invalid.length} address${invalid.length === 1 ? ' is' : 'es are'} not valid: ${invalid
        .slice(0, 10)
        .join(', ')}${invalid.length > 10 ? ', …' : ''}`
    );
  }

  if (valid.length === 0) {
    throw new BadRequestError('No recipients. Separate addresses with commas, spaces or new lines.');
  }

  if (valid.length > MAXIMUM_RECIPIENTS) {
    throw new BadRequestError(
      `${valid.length} recipients exceeds the limit of ${MAXIMUM_RECIPIENTS} per send.`
    );
  }

  const result = await mailerBulk(
    valid.map((email) => ({ email })),
    { subject, text, html, template, cta: { label: ctaLabel, url: ctaUrl } }
  );

  const parts = [`Sent to ${result.sent} of ${valid.length}.`];
  if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates === 1 ? '' : 's'} removed.`);
  if (result.failed > 0) parts.push(`Failed: ${result.failedRecipients.slice(0, 5).join(', ')}.`);

  res.json({
    // False only when nothing went out at all.
    succeed: result.sent > 0,
    msg: parts.join(' '),
    sent: result.sent,
    failed: result.failed,
    total: valid.length,
  });
};

const smsToClient = async (req, res) => {
  const mode = req.params.mode;
  const { phone, message } = req.body ?? {};

  if (!phone || !message) throw new BadRequestError('A number and a message are both required.');

  const result = await sendSMS(phone, message, { mode: mode || 'custom' });
  res.json({ succeed: result.ok, msg: result.msg, code: result.code });
};

/** All-or-nothing at the gateway. Only locally rejected numbers partial it. */
const sendBulkSms = async (req, res) => {
  const { numbers, message } = req.body ?? {};

  if (!message) throw new BadRequestError('The message is empty.');

  const parsed = parseNumbers(numbers);

  if (parsed.length === 0) {
    throw new BadRequestError('No numbers. Separate them with commas, spaces or new lines.');
  }

  if (parsed.length > MAXIMUM_RECIPIENTS) {
    throw new BadRequestError(
      `${parsed.length} numbers exceeds the limit of ${MAXIMUM_RECIPIENTS} per send.`
    );
  }

  const result = await sendBulkSMS(parsed, message);

  const parts = [result.msg];
  if (result.sent > 0) parts.push(`Sent to ${result.sent}.`);
  if (result.rejected.length > 0) {
    parts.push(`Skipped ${result.rejected.length} invalid: ${result.rejected.slice(0, 5).join(', ')}.`);
  }

  res.json({
    succeed: result.sent > 0,
    msg: parts.join(' '),
    code: result.code,
    sent: result.sent,
    failed: result.failed,
    total: parsed.length,
  });
};

const smsBalance = async (req, res) => {
  const result = await getBalance();
  res.json({ succeed: result.ok, balance: result.balance ?? null, msg: result.msg });
};

module.exports = {
  sendEmailToClient,
  sendBulkEmail,
  smsToClient,
  sendBulkSms,
  smsBalance,
};
