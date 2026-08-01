'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

const { normaliseNumber } = require('../utils/sendSMS');
const { parseEmails, parseNumbers } = require('../utils/recipients');

// These decide who gets a message and who is charged for it, and both fail
// silently when wrong. No database, no network.

test('accepts the number formats people actually type', () => {
  const accepted = {
    '01712345678': '8801712345678',
    '+8801712345678': '8801712345678',
    '8801712345678': '8801712345678',
    '1712345678': '8801712345678',
    '017 1234 5678': '8801712345678',
    '017-1234-5678': '8801712345678',
    '(017) 1234-5678': '8801712345678',
  };

  for (const [input, expected] of Object.entries(accepted)) {
    assert.equal(normaliseNumber(input), expected, `${input} should normalise`);
  }
});

test('every Bangladeshi mobile prefix normalises', () => {
  for (let prefix = 3; prefix <= 9; prefix += 1) {
    const number = `01${prefix}12345678`;
    assert.equal(normaliseNumber(number), `8801${prefix}12345678`);
  }
});

test('rejects what the gateway cannot deliver to', () => {
  const rejected = [
    '01212345678', // unallocated prefix
    '01012345678',
    '0171234567', // one digit short
    '017123456789', // one digit long
    '+14155550100', // not a Bangladeshi number
    'not a number',
    '',
    null,
    undefined,
  ];

  for (const input of rejected) {
    assert.equal(normaliseNumber(input), null, `${input} should be rejected`);
  }
});

test('splits recipients on commas, spaces, semicolons and new lines', () => {
  const { valid, invalid } = parseEmails(
    'one@example.com, two@example.com three@example.com;four@example.com\nfive@example.com'
  );

  assert.deepEqual(valid, [
    'one@example.com',
    'two@example.com',
    'three@example.com',
    'four@example.com',
    'five@example.com',
  ]);
  assert.deepEqual(invalid, []);
});

test('reports bad addresses instead of dropping them', () => {
  const { valid, invalid } = parseEmails('good@example.com, not-an-address, also@bad');

  assert.deepEqual(valid, ['good@example.com']);
  assert.deepEqual(invalid, ['not-an-address', 'also@bad']);
});

test('removes duplicates regardless of case', () => {
  const { valid, duplicates } = parseEmails('a@example.com, A@Example.com, b@example.com');

  assert.deepEqual(valid, ['a@example.com', 'b@example.com']);
  assert.equal(duplicates, 1);
});

test('trailing separators and blank entries do not become recipients', () => {
  const { valid, invalid } = parseEmails('  a@example.com ,, b@example.com ,  \n ');

  assert.deepEqual(valid, ['a@example.com', 'b@example.com']);
  assert.deepEqual(invalid, []);
});

test('numbers are split but not validated here', () => {
  // Validation belongs to the gateway client; two copies would drift.
  assert.deepEqual(parseNumbers('01712345678, 01812345678\n01912345678'), [
    '01712345678',
    '01812345678',
    '01912345678',
  ]);
});

const { htmlCreator } = require('../utils/htmlTemplates');

const render = (info, client = { fullName: 'Sara' }) => htmlCreator('custom', { info, client });

test('recipient content is escaped, never rendered as markup', () => {
  const out = render({ subject: 's', body: '<script>alert(1)</script>' });

  assert.ok(!out.body.includes('<script>alert'), 'script tag survived into the HTML');
  assert.ok(out.body.includes('&lt;script&gt;'), 'expected the tag to be escaped');
});

test('a name containing markup cannot break the table layout', () => {
  const out = render({ subject: 's', body: 'hi' }, { fullName: '</td></tr></table><b>X' });

  assert.ok(!out.body.includes('</td></tr></table><b>X'));
});

test('blank lines become paragraphs and single newlines become breaks', () => {
  const out = render({ subject: 's', body: 'one\n\ntwo\nthree' });

  assert.ok(out.body.includes('two<br />three'), 'single newline should be a break');
  // Greeting, then two body paragraphs.
  assert.equal((out.body.match(/line-height:1\.65/g) || []).length, 3);
});

test('the button renders only when it has both a label and a safe URL', () => {
  const hasButton = (cta) => /class="btn-a"/.test(render({ subject: 's', body: 'hi', cta }).body);

  assert.equal(hasButton({ label: 'Go', url: 'https://example.com' }), true);
  assert.equal(hasButton(undefined), false);
  assert.equal(hasButton({ label: '', url: 'https://example.com' }), false);
  assert.equal(hasButton({ label: 'Go', url: '' }), false);
  // A pasted javascript: URL must not become a link.
  assert.equal(hasButton({ label: 'Go', url: 'javascript:alert(1)' }), false);
  assert.equal(hasButton({ label: 'Go', url: '/relative' }), false);
});

test('the plain-text part is plain text', () => {
  // It used to be a whole HTML document assigned to nodemailer's `text` field.
  const out = render({ subject: 's', body: 'hi' });

  assert.ok(!out.text.includes('<'), 'text part contains markup');
  assert.ok(out.text.startsWith('Dear Sara,'));
});

test('a missing name falls back rather than greeting nobody', () => {
  const out = render({ subject: 's', body: 'hi' }, {});

  assert.ok(out.body.includes('Hello,'));
  assert.ok(out.text.startsWith('Hello,'));
});

const { sanitiseToEmailHtml } = require('../utils/emailHtml');

test('unsafe markup never reaches an inbox', () => {
  const unsafe = {
    '<p>a</p><script>alert(1)</script>': /script/i,
    '<p onclick="alert(1)">a</p>': /onclick/i,
    '<p>a</p><img src="https://tracker.io/p.gif">': /<img/i,
    '<iframe src="https://x.com"></iframe>': /iframe/i,
    '<a href="javascript:alert(1)">x</a>': /javascript:/i,
    '<style>body{display:none}</style><p>a</p>': /display:none/i,
    // An incoming style is discarded rather than merged, so nothing can
    // reposition itself over the rest of the message.
    '<p style="position:fixed;top:0">a</p>': /position:fixed/i,
    '<form action="https://evil"><input></form>': /<form|<input/i,
  };

  for (const [input, forbidden] of Object.entries(unsafe)) {
    assert.ok(!forbidden.test(sanitiseToEmailHtml(input)), `${forbidden} survived`);
  }
});

test('safe links are kept and hardened', () => {
  const out = sanitiseToEmailHtml('<a href="https://ok.com">ok</a>');

  assert.match(out, /href="https:\/\/ok\.com"/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener noreferrer"/);
  assert.match(sanitiseToEmailHtml('<a href="mailto:a@b.com">m</a>'), /mailto:a@b\.com/);
});

test('every block carries an inline style, since clients drop stylesheets', () => {
  const out = sanitiseToEmailHtml('<h2>H</h2><p>P</p><ul><li>L</li></ul><blockquote>Q</blockquote>');

  for (const tag of ['h2', 'p', 'ul', 'li', 'blockquote']) {
    assert.match(out, new RegExp(`<${tag} style="[^"]+"`), `${tag} has no inline style`);
  }
});

test("the editor's list-item paragraphs and trailing break are removed", () => {
  // TipTap emits <li><p>text</p></li> and keeps an empty trailing paragraph for
  // the cursor. Both would arrive as unwanted blank space.
  const out = sanitiseToEmailHtml(
    '<ul><li><p>one</p></li><li><p>two</p></li></ul><p><br class="ProseMirror-trailingBreak"></p>'
  );

  assert.ok(!/<li[^>]*><p/.test(out), 'list item still wraps a paragraph');
  assert.ok(!/<p[^>]*>(\s|<br\s*\/?>)*<\/p>\s*$/.test(out), 'trailing empty paragraph remains');
});

test('raw mode sends the message alone; branded wraps it', () => {
  const info = { subject: 's', html: '<p>Body</p>' };

  const raw = htmlCreator('custom', { info: { ...info, template: 'raw' }, client: { fullName: 'Sara' } });
  const branded = htmlCreator('custom', { info, client: { fullName: 'Sara' } });

  for (const marker of ['Dear Sara', 'Best regards', 'github.com/khalid999devs']) {
    assert.ok(branded.body.includes(marker), `branded is missing ${marker}`);
    assert.ok(!raw.body.includes(marker), `raw should not contain ${marker}`);
  }

  // The message itself is identical either way.
  assert.ok(raw.body.includes('Body') && branded.body.includes('Body'));
  assert.ok(!raw.text.includes('Best regards'));
});
