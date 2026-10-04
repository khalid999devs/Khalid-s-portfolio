'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

const db = require('../models');
const store = require('../utils/clientErrorStore');
const { getNotifications } = require('../controllers/notifications');

// The browser error alert, with every query the handler makes replaced.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0';

/** Quiet answers for everything the handler reads from the database. */
const quietDatabase = (t) => {
  t.mock.method(db.settings, 'findOne', async () => ({ resume: null }));
  t.mock.method(db.Admin, 'count', async () => 2);
  t.mock.method(db.projects, 'findAll', async () => []);
  t.mock.method(db.DeliveryLog, 'count', async () => 0);
  t.mock.method(db.AppSetting, 'findByPk', async () => null);
  t.mock.method(db.sequelize, 'query', async () => [[]]);
};

const recentErrors = (t, summary) => t.mock.method(store, 'summary', () => summary);

const notifications = async () => {
  let payload;
  await getNotifications({}, { json: (body) => (payload = body) });
  return payload;
};

const errorAlerts = (payload) => payload.result.filter((item) => item.action === 'errors');

test('recent browser errors raise one alert in the shape the bell renders', async (t) => {
  quietDatabase(t);
  recentErrors(t, {
    distinct: 3,
    reports: 41,
    worst: { message: 'TypeError: projects.map is not a function', userAgent: UA, count: 27 },
  });

  const payload = await notifications();
  const [alert, ...others] = errorAlerts(payload);

  assert.deepEqual(others, []);
  assert.deepEqual(alert, {
    id: 'warning:3 distinct browser errors this week',
    severity: 'warning',
    title: '3 distinct browser errors this week',
    detail:
      'Reported 41 times in total. Most frequent, 27 times: ' +
      `"TypeError: projects.map is not a function" Last seen in ${UA}.`,
    action: 'errors',
  });
  // A warning, so it reaches the badge.
  assert.equal(payload.counts.warning >= 1, true);
  assert.equal(payload.succeed, true);
});

test('a single error reported once reads in the singular', async (t) => {
  quietDatabase(t);
  recentErrors(t, { distinct: 1, reports: 1, worst: { message: 'boom', userAgent: UA, count: 1 } });

  const [alert] = errorAlerts(await notifications());

  assert.equal(alert.title, '1 distinct browser error this week');
  assert.match(alert.detail, /^Reported 1 time in total\. Most frequent, 1 time: "boom"/);
});

test('a long message and user agent are cut, and a missing agent is named', async (t) => {
  quietDatabase(t);
  recentErrors(t, {
    distinct: 2,
    reports: 9,
    worst: { message: 'm'.repeat(500), userAgent: 'u'.repeat(300), count: 5 },
  });
  const [long] = errorAlerts(await notifications());

  assert.ok(long.detail.includes(`"${'m'.repeat(159)}…"`));
  assert.ok(long.detail.includes(`Last seen in ${'u'.repeat(119)}….`));
  assert.ok(long.detail.length < 400, `detail is ${long.detail.length} characters`);

  t.mock.restoreAll();
  quietDatabase(t);
  recentErrors(t, { distinct: 1, reports: 2, worst: { message: 'boom', userAgent: '', count: 2 } });
  const [anonymous] = errorAlerts(await notifications());

  assert.ok(anonymous.detail.endsWith('Last seen in an unknown browser.'));
});

test('only errors seen in the last seven days are asked for', async (t) => {
  quietDatabase(t);
  const summary = recentErrors(t, {
    distinct: 1,
    reports: 1,
    worst: { message: 'boom', userAgent: UA, count: 1 },
  });

  await notifications();

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const [since] = summary.mock.calls[0].arguments;
  assert.equal(typeof since, 'number');
  assert.ok(Math.abs(since - weekAgo) < 5000, 'the window should start seven days ago');
});

test('no recent errors, no alert', async (t) => {
  quietDatabase(t);
  recentErrors(t, { distinct: 0, reports: 0, worst: null });

  const payload = await notifications();

  assert.deepEqual(errorAlerts(payload), []);
  // Everything else is still reported.
  assert.ok(payload.result.some((item) => item.title === 'No resume published'));
  assert.equal(payload.total, payload.counts.critical + payload.counts.warning);
});
