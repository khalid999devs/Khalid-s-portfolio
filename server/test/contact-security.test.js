const assert = require('node:assert/strict');
const test = require('node:test');

const { sendEmailToClient } = require('../controllers/contact');
const {
  normalizeEmailDeliveryRequest,
  normalizeSmsDeliveryRequest,
} = require('../utils/contactValidation');
const { htmlCreator } = require('../utils/htmlTemplates');
const { EmailCover } = require('../utils/TemplateCover');

// Outbound administrator messaging only. There is no public intake endpoint,
// no stored inbox, and no contact-reply delivery state to reconcile.

test('outbound email HTML escapes names and body while preserving line breaks', () => {
  const email = htmlCreator('custom', {
    client: { fullName: '<img src=x onerror="alert(1)">' },
    info: {
      subject: 'Project update',
      body: 'Hello <script>alert(1)</script> & goodbye\nNext line',
    },
  });

  assert.equal(email.subject, 'Project update');
  assert.equal(email.body.includes('<script>'), false);
  assert.equal(email.body.includes('<img'), false);
  assert.match(email.body, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(email.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(email.body, /&amp; goodbye<br \/>Next line/);
});

test('newsletter uses escaped supplied content instead of a placeholder', () => {
  const email = htmlCreator('newsletter', {
    client: { fullName: 'Reader' },
    info: { subject: 'News', body: 'Actual <b>content</b>' },
  });

  assert.equal(email.subject, 'News');
  assert.match(email.body, /Actual &lt;b&gt;content&lt;\/b&gt;/);
  assert.equal(email.body.includes('Newsletter body'), false);
  assert.equal(email.text, 'Actual <b>content</b>');
});

test('email wrapper is self-contained and contains no copied business data', () => {
  const wrapped = EmailCover('<p>Safe body</p>', 'Portfolio <Owner>');

  assert.match(wrapped, /Portfolio &lt;Owner&gt;/);
  assert.equal(wrapped.includes('Golden Dot'), false);
  assert.equal(wrapped.includes('<img'), false);
  assert.equal(wrapped.includes('http://'), false);
  assert.equal(wrapped.includes('https://'), false);
});

test('outbound email rejects retired modes and oversized content before sending', async () => {
  await assert.rejects(
    sendEmailToClient(
      {
        params: { mode: 'contact' },
        body: { id: '1', text: 'Reply' },
      },
      {}
    ),
    /Unsupported email delivery mode/
  );

  await assert.rejects(
    sendEmailToClient(
      {
        params: { mode: 'custom' },
        body: {
          email: 'recipient@example.com',
          subject: 'Subject',
          text: 'x'.repeat(5_001),
        },
      },
      {}
    ),
    /between 1 and 5000/
  );
});

test('outbound email requests are mode-specific, normalized, and bounded', () => {
  assert.deepEqual(
    normalizeEmailDeliveryRequest('custom', {
      email: 'Ada@Example.COM',
      name: '  Ada   Lovelace ',
      subject: '  Portfolio enquiry ',
      text: ' Hello\r\nWorld ',
    }),
    {
      email: 'Ada@example.com',
      name: 'Ada Lovelace',
      subject: 'Portfolio enquiry',
      text: 'Hello\nWorld',
    }
  );

  assert.throws(
    () => normalizeEmailDeliveryRequest('contact', { id: '42', text: 'Reply' }),
    /Unsupported email delivery mode/
  );
  assert.throws(
    () =>
      normalizeEmailDeliveryRequest('custom', {
        email: 'recipient@example.com',
        subject: 'Hello\nBcc: hidden@example.com',
        text: 'Message',
      }),
    /subject must be valid text/
  );
  assert.throws(
    () =>
      normalizeEmailDeliveryRequest('custom', {
        email: 'recipient@example.com',
        subject: 'Subject',
        text: 'Message',
        id: 1,
      }),
    /Unexpected field: id/
  );
  assert.throws(
    () => normalizeEmailDeliveryRequest('custom'),
    /Request body must be an object/
  );
});

test('outbound SMS requests reject unknown modes, fields, and oversized text', () => {
  assert.deepEqual(
    normalizeSmsDeliveryRequest('custom', {
      phone: '+880 1712-345678',
      message: ' Hello ',
    }),
    { phone: '01712345678', message: 'Hello' }
  );
  assert.throws(
    () =>
      normalizeSmsDeliveryRequest('contact', {
        phone: '01712345678',
        message: 'Hello',
      }),
    /Unsupported SMS delivery mode/
  );
  assert.throws(
    () =>
      normalizeSmsDeliveryRequest('custom', {
        phone: '01712345678',
        message: 'Hello',
        provider: 'alternate',
      }),
    /Unexpected field: provider/
  );
  assert.throws(
    () =>
      normalizeSmsDeliveryRequest('custom', {
        phone: '01712345678',
        message: 'x'.repeat(1_001),
      }),
    /between 1 and 1000/
  );
});
