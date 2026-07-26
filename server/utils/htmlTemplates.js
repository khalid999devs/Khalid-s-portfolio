const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const asHtmlText = (value) =>
  escapeHtml(String(value ?? '').replace(/\r\n?/g, '\n')).replace(
    /\n/g,
    '<br />'
  );

const htmlCreator = (mode, data) => {
  const info = data?.info || {};
  const rawName = String(data?.client?.fullName || '').trim();
  const rawBody = String(info.body || '').replace(/\r\n?/g, '\n').trim();
  const safeName = escapeHtml(rawName);
  const safeBody = asHtmlText(rawBody);
  const subject = info.subject;

  if (mode === 'newsletter') {
    return {
      subject,
      body: `<p style="color: #3A1500; margin: 20px 0;">${safeBody}</p>`,
      text: rawBody,
    };
  }

  const greeting = safeName
    ? `<p style="color: #3A1500; margin: 0;">Dear ${safeName},</p>`
    : '';

  return {
    subject,
    body: `${greeting}<p style="color: #3A1500; margin: 20px 0;">${safeBody}</p>`,
    text: rawName ? `Dear ${rawName},\n\n${rawBody}` : rawBody,
  };
};

module.exports = { asHtmlText, escapeHtml, htmlCreator };
