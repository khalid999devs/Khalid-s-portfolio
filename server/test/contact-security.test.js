const assert = require('node:assert/strict');
const test = require('node:test');

const { Contact } = require('../models');
const {
  getAllMessage,
  sendEmailToClient,
  sendMessage,
} = require('../controllers/contact');
const {
  normalizeContactMessage,
  parseMessageListQuery,
} = require('../utils/contactValidation');
const { htmlCreator } = require('../utils/htmlTemplates');
const { EmailCover } = require('../utils/TemplateCover');

test('public contact input is normalized to an explicit persistence shape', () => {
  assert.deepEqual(
    normalizeContactMessage({
      name: '  Ada   Lovelace  ',
      phone: '+880 1712-345678',
      email: 'Ada@Example.COM',
      address: '  Dhaka   Bangladesh  ',
      message: '  First line\r\nSecond line  ',
    }),
    {
      name: 'Ada Lovelace',
      phone: '01712345678',
      email: 'Ada@example.com',
      address: 'Dhaka Bangladesh',
      message: 'First line\nSecond line',
    }
  );

  assert.deepEqual(
    normalizeContactMessage({
      name: 'Grace Hopper',
      phone: '01812345678',
      email: '',
      address: '   ',
      message: 'Hello',
    }),
    {
      name: 'Grace Hopper',
      phone: '01812345678',
      email: null,
      address: null,
      message: 'Hello',
    }
  );
});

test('public contact input rejects unknown, malformed, and oversized fields', () => {
  const valid = {
    name: 'Ada Lovelace',
    phone: '01712345678',
    message: 'Hello',
  };

  assert.throws(
    () => normalizeContactMessage({ ...valid, isAdmin: true }),
    /Unexpected field: isAdmin/
  );
  assert.throws(
    () => normalizeContactMessage({ ...valid, phone: '12345' }),
    /valid Bangladeshi mobile number/
  );
  assert.throws(
    () => normalizeContactMessage({ ...valid, email: 'invalid@' }),
    /valid email address/
  );
  assert.throws(
    () => normalizeContactMessage({ ...valid, message: 'x'.repeat(5_001) }),
    /between 1 and 5000/
  );
});

test('sendMessage persists only normalized allowlisted fields', async () => {
  const originalCreate = Contact.create;
  let persisted;
  let responseBody;
  Contact.create = async (value) => {
    persisted = value;
    return value;
  };

  try {
    await sendMessage(
      {
        body: {
          name: '  Ada   Lovelace ',
          phone: '8801712345678',
          email: 'ada@EXAMPLE.COM',
          address: '',
          message: ' Hello ',
        },
      },
      {
        json(value) {
          responseBody = value;
        },
      }
    );

    assert.deepEqual(persisted, {
      name: 'Ada Lovelace',
      phone: '01712345678',
      email: 'ada@example.com',
      address: null,
      message: 'Hello',
    });
    assert.equal(responseBody.succeed, true);
  } finally {
    Contact.create = originalCreate;
  }
});

test('message listing uses strict, bounded pagination while preserving result', async () => {
  assert.deepEqual(parseMessageListQuery({}), {
    page: 1,
    limit: 50,
    offset: 0,
  });
  assert.throws(
    () => parseMessageListQuery({ limit: '101' }),
    /must not exceed 100/
  );
  assert.throws(
    () => parseMessageListQuery({ page: '1.5' }),
    /positive integer/
  );
  assert.throws(
    () => parseMessageListQuery({ sort: 'id' }),
    /Unexpected field: sort/
  );

  const originalFindAndCountAll = Contact.findAndCountAll;
  const messages = [{ id: 3 }, { id: 2 }];
  let queryOptions;
  let responseBody;
  Contact.findAndCountAll = async (options) => {
    queryOptions = options;
    return { count: 42, rows: messages };
  };

  try {
    await getAllMessage(
      { query: { page: '2', limit: '20' } },
      {
        json(value) {
          responseBody = value;
        },
      }
    );

    assert.deepEqual(queryOptions, {
      order: [['id', 'DESC']],
      limit: 20,
      offset: 20,
    });
    assert.equal(responseBody.result, messages);
    assert.deepEqual(responseBody.pagination, {
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  } finally {
    Contact.findAndCountAll = originalFindAndCountAll;
  }
});

test('outbound email HTML escapes names and body while preserving line breaks', () => {
  const email = htmlCreator('contact', {
    client: { fullName: '<img src=x onerror="alert(1)">' },
    info: { body: 'Hello <script>alert(1)</script> & goodbye\nNext line' },
  });

  assert.equal(email.subject, 'We are here for you!');
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

test('contact replies reject ambiguous IDs and oversized content before sending', async () => {
  await assert.rejects(
    sendEmailToClient(
      {
        params: { mode: 'contact' },
        body: { id: '1anything', text: 'Reply' },
      },
      {}
    ),
    /valid contact ID/
  );

  await assert.rejects(
    sendEmailToClient(
      {
        params: { mode: 'custom' },
        body: {
          email: 'recipient@example.com',
          text: 'x'.repeat(5_001),
        },
      },
      {}
    ),
    /between 1 and 5000/
  );
});
