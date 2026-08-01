'use strict';

const { renderHtml, renderRaw, renderText } = require('./emailTemplate');
const { sanitiseToEmailHtml, htmlToPlainText, plainTextToHtml } = require('./emailHtml');

/**
 * Builds the HTML and plain-text parts for one message.
 *
 * `info.html` is rich text from the editor; `info.body` is a plain textarea.
 * Either is accepted so nothing that already calls this has to change.
 *
 * `info.template: 'raw'` sends the message alone, with no greeting, branding or
 * signature. Anything else gets the full layout.
 */
const htmlCreator = (mode, data) => {
  const info = data?.info ?? {};
  const client = data?.client ?? {};

  const name = String(client.fullName ?? '').trim();
  const greeting = name ? `Dear ${name}` : 'Hello';
  const branded = info.template !== 'raw';

  // Sanitising happens either way. The editor is trusted, but its output still
  // has to be reduced to tags an inbox will render.
  const bodyHtml = info.html
    ? sanitiseToEmailHtml(info.html)
    : plainTextToHtml(info.body ?? info.text ?? '');

  const bodyText = htmlToPlainText(bodyHtml);

  const subject =
    mode === 'contact' ? info.subject || 'We are here for you' : info.subject || '';

  // First line of the message, for the inbox preview.
  const preheader = bodyText.replace(/\s+/g, ' ').trim().slice(0, 140);

  const parts = { greeting, bodyHtml, cta: info.cta, preheader };

  return {
    subject,
    body: branded ? renderHtml(parts) : renderRaw(parts),
    text: renderText({ greeting, bodyText, cta: info.cta, branded }),
  };
};

module.exports = { htmlCreator };
