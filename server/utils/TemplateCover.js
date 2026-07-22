const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Wrap already-sanitized message markup in a small, self-contained email.
 * No remote images, fonts, tracking pixels, addresses, or unrelated branding
 * are embedded in outgoing portfolio messages.
 */
const EmailCover = (body, senderName = 'Khalid Ahammed') => {
  const safeSenderName = escapeHtml(senderName);
  const year = new Date().getUTCFullYear();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Message from ${safeSenderName}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
            <tr>
              <td style="padding:28px;line-height:1.6;">
                ${body}
                <p style="margin:28px 0 0;">Best regards,<br /><strong>${safeSenderName}</strong></p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;color:#71717a;font-size:12px;">&copy; ${year} ${safeSenderName}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

module.exports = { EmailCover };
