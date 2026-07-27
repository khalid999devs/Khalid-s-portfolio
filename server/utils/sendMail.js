const nodemailer = require('nodemailer');
const { htmlCreator } = require('./htmlTemplates');
const { EmailCover, EmailTextCover } = require('./TemplateCover');
const { recordDelivery } = require('./deliveryLog');

/**
 * SMTP transport.
 *
 * `tls.rejectUnauthorized` used to be false here, which turns off certificate
 * verification on the connection carrying the mailbox password. Anything able
 * to intercept that connection could present its own certificate, be trusted,
 * and read the credentials. It is on now.
 *
 * There is no way to turn it off. A provider with a broken certificate chain
 * is a problem to fix with the provider.
 */
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
    // Never optional. This connection carries the mailbox password, and the
    // escape hatch that used to exist here is the kind that gets switched on
    // during an incident and never switched back off.
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  },
});

const mailer = async (data, mode) => {
  const { subject, body, text } = htmlCreator(mode, data);
  const recipient = data?.client?.email;

  const mailContent = {
    from: `GOLDEN DOT PROPERTIES LTD. <${process.env.SERVER_EMAIL}>`,
    to: `${recipient}`,
    subject,
    html: body ? EmailCover(body) : null,
    text: text ? EmailTextCover(text) : null,
  };

  const startedAt = Date.now();

  try {
    const info = await transporter.sendMail(mailContent);

    // Awaited rather than fired and forgotten: a log written after the response
    // has gone out cannot be reported if it fails, and the write is a single
    // indexed insert.
    await recordDelivery({
      channel: 'email',
      mode,
      recipient,
      subject,
      status: 'succeeded',
      providerCode: info?.response ? String(info.response).slice(0, 32) : null,
      detail: Array.isArray(info?.accepted) ? `accepted: ${info.accepted.join(', ')}` : null,
      durationMs: Date.now() - startedAt,
    });

    return 'success';
  } catch (error) {
    await recordDelivery({
      channel: 'email',
      mode,
      recipient,
      subject,
      status: 'failed',
      providerCode: error?.code ? String(error.code) : null,
      detail: error?.message,
      durationMs: Date.now() - startedAt,
    });

    // The caller only ever sees a generic failure; the reason is in the log
    // table, which is behind admin authentication.
    throw new Error('email sending failed. something went wrong');
  }
};

module.exports = mailer;
