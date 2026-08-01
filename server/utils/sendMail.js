const nodemailer = require('nodemailer');
const { htmlCreator } = require('./htmlTemplates');
const { recordDelivery } = require('./deliveryLog');

const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 465,
  secure: true, // implicit TLS
  auth: {
    user: process.env.SERVER_EMAIL,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    // Carries the mailbox password. Not optional, no escape hatch.
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  },
});

const FROM_NAME = process.env.MAIL_FROM_NAME || 'Khalid Ahammed';

/** Messages in flight at once during a bulk send. */
const CONCURRENCY = 5;

/** Sends one message, no log row. Bulk calls this many times for one report. */
const deliver = async (data, mode) => {
  const { subject, body, text } = htmlCreator(mode, data);
  const recipient = data?.client?.email;

  const mailContent = {
    from: `${FROM_NAME} <${process.env.SERVER_EMAIL}>`,
    to: `${recipient}`,
    subject,
    html: body,
    // The real plain-text alternative. Sending HTML here, as this used to, both
    // shows markup in text-only clients and reads as spam.
    text,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  };

  const startedAt = Date.now();

  try {
    const info = await transporter.sendMail(mailContent);
    return {
      ok: true,
      recipient,
      subject,
      providerCode: info?.response ? String(info.response).slice(0, 32) : null,
      detail: Array.isArray(info?.accepted) ? `accepted: ${info.accepted.join(', ')}` : null,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      recipient,
      subject,
      providerCode: error?.code ? String(error.code) : null,
      detail: error?.message,
      durationMs: Date.now() - startedAt,
    };
  }
};

const mailer = async (data, mode) => {
  const outcome = await deliver(data, mode);

  await recordDelivery({
    channel: 'email',
    kind: 'single',
    mode,
    recipient: outcome.recipient,
    subject: outcome.subject,
    status: outcome.ok ? 'succeeded' : 'failed',
    providerCode: outcome.providerCode,
    detail: outcome.detail,
    durationMs: outcome.durationMs,
  });

  // Generic on purpose. The reason is in the admin-only log table.
  if (!outcome.ok) throw new Error('email sending failed. something went wrong');

  return 'success';
};

/**
 * Same message to many addresses, one report row.
 * Individual sends, not BCC: keeps the list private and identifies which
 * address bounced. Bounded concurrency so sixty addresses neither outlive the
 * request nor open sixty SMTP connections.
 */
const mailerBulk = async (recipients, { subject, text, html, template, cta, mode = 'bulk' }) => {
  const startedAt = Date.now();
  const outcomes = [];
  const queue = [...recipients];

  const worker = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      outcomes.push(
        await deliver(
          {
            info: { subject, body: text, html, template, cta },
            client: { fullName: next.name || next.email, email: next.email },
          },
          'custom'
        )
      );
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  const failures = outcomes.filter((outcome) => !outcome.ok);
  const succeeded = outcomes.length - failures.length;

  // Named, not just counted. Truncated to fit the column; the count stays exact.
  const namedFailures = failures.slice(0, 8).map((failure) => failure.recipient);
  const detail =
    failures.length === 0
      ? `Delivered to all ${succeeded}.`
      : `Failed for ${namedFailures.join(', ')}` +
        (failures.length > namedFailures.length
          ? ` and ${failures.length - namedFailures.length} more.`
          : '.') +
        ` Last error: ${failures[failures.length - 1].detail || 'unknown'}`;

  await recordDelivery({
    channel: 'email',
    kind: 'bulk',
    mode,
    recipient: `${outcomes.length} recipients`,
    subject,
    status: succeeded === 0 ? 'failed' : failures.length > 0 ? 'partial' : 'succeeded',
    providerCode: null,
    detail,
    recipientCount: outcomes.length,
    succeededCount: succeeded,
    failedCount: failures.length,
    durationMs: Date.now() - startedAt,
  });

  return {
    sent: succeeded,
    failed: failures.length,
    failedRecipients: failures.map((failure) => failure.recipient),
  };
};

module.exports = { mailer, mailerBulk };
