'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  mkdirSync,
  chmodSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const { createStore, MAXIMUM_ENTRIES } = require('../utils/clientErrorStore');

// The store against real files in a scratch folder. No database anywhere.

const scratch = mkdtempSync(join(tmpdir(), 'client-errors-'));
test.after(() => rmSync(scratch, { recursive: true, force: true }));

let folders = 0;
/** A fresh private folder and the file a store would keep in it. */
const freshFile = () => {
  folders += 1;
  return join(scratch, `store-${folders}`, 'client-errors.json');
};

const report = (overrides = {}) => ({
  fingerprint: 'a'.repeat(64),
  kind: 'error',
  message: 'TypeError: x is undefined',
  stack: 'TypeError: x is undefined\n    at a.js:1:1',
  source: 'https://example.com/a.js',
  line: 1,
  col: 1,
  path: '/works',
  userAgent: 'Firefox/130.0',
  viewport: '1440x900',
  build: 'df578af',
  ...overrides,
});

const at = (iso) => new Date(iso);
const onDisk = (file) => JSON.parse(readFileSync(file, 'utf8'));

test('a new report is stored once, counted from one', async () => {
  const file = freshFile();
  const store = createStore(file);

  await store.record(report(), at('2026-10-04T10:00:00.000Z'));

  const expected = {
    ...report(),
    count: 1,
    firstSeenAt: '2026-10-04T10:00:00.000Z',
    lastSeenAt: '2026-10-04T10:00:00.000Z',
  };
  assert.deepEqual(store.list(), [expected]);
  assert.deepEqual(onDisk(file), [expected]);
});

test('a repeat is counted and refreshes only what describes the latest report', async () => {
  const store = createStore(freshFile());

  await store.record(report(), at('2026-10-04T10:00:00.000Z'));
  await store.record(
    report({
      message: 'ignored: the fingerprint says it is the same error',
      stack: 'ignored',
      userAgent: 'Safari/26',
      path: '/about-me',
      viewport: '390x844',
      build: 'abc1234',
    }),
    at('2026-10-04T11:30:00.000Z')
  );

  assert.deepEqual(store.list(), [
    {
      ...report(),
      userAgent: 'Safari/26',
      path: '/about-me',
      viewport: '390x844',
      build: 'abc1234',
      count: 2,
      firstSeenAt: '2026-10-04T10:00:00.000Z',
      lastSeenAt: '2026-10-04T11:30:00.000Z',
    },
  ]);
});

test('the list is newest first and honours its limit', async () => {
  const store = createStore(freshFile());
  await store.record(report({ fingerprint: 'one' }), at('2026-10-01T00:00:00.000Z'));
  await store.record(report({ fingerprint: 'two' }), at('2026-10-03T00:00:00.000Z'));
  await store.record(report({ fingerprint: 'three' }), at('2026-10-02T00:00:00.000Z'));
  // A repeat moves an old entry to the front.
  await store.record(report({ fingerprint: 'one' }), at('2026-10-04T00:00:00.000Z'));

  assert.deepEqual(store.list().map((entry) => entry.fingerprint), ['one', 'two', 'three']);
  assert.deepEqual(store.list(2).map((entry) => entry.fingerprint), ['one', 'two']);
});

test(`only the ${MAXIMUM_ENTRIES} most recently seen are kept`, async () => {
  const file = freshFile();
  const store = createStore(file);
  const day = (index) => at(new Date(Date.UTC(2026, 0, 1) + index * 60000).toISOString());

  for (let index = 0; index < MAXIMUM_ENTRIES; index += 1) {
    store.record(report({ fingerprint: `error-${index}` }), day(index));
  }
  // The oldest is seen again, so the one after it is now the oldest.
  store.record(report({ fingerprint: 'error-0' }), day(MAXIMUM_ENTRIES));
  await store.record(report({ fingerprint: 'newcomer' }), day(MAXIMUM_ENTRIES + 1));

  const kept = store.list().map((entry) => entry.fingerprint);
  assert.equal(kept.length, MAXIMUM_ENTRIES);
  assert.equal(kept[0], 'newcomer');
  assert.ok(kept.includes('error-0'));
  assert.ok(!kept.includes('error-1'));
  assert.equal(onDisk(file).length, MAXIMUM_ENTRIES);
});

test('a second store on the same file starts with what the first one saved', async () => {
  const file = freshFile();
  const first = createStore(file);
  await first.record(report({ fingerprint: 'kept' }), at('2026-10-04T10:00:00.000Z'));
  await first.record(report({ fingerprint: 'kept' }), at('2026-10-04T10:05:00.000Z'));

  const second = createStore(file);
  assert.deepEqual(second.list(), first.list());
  assert.equal(second.list()[0].count, 2);
});

test('a burst of reports ends as one whole file holding all of them', async () => {
  const file = freshFile();
  const store = createStore(file);

  const writes = Array.from({ length: 40 }, (_, index) =>
    store.record(report({ fingerprint: `burst-${index}` }), at('2026-10-04T10:00:00.000Z'))
  );
  await Promise.all(writes);

  assert.equal(onDisk(file).length, 40);
  // No half-written sibling is left behind.
  assert.deepEqual(readdirSync(join(file, '..')), ['client-errors.json']);
});

test('clearing empties memory and the file, and says how many went', async () => {
  const file = freshFile();
  const store = createStore(file);
  await store.record(report({ fingerprint: 'one' }));
  await store.record(report({ fingerprint: 'two' }));

  assert.equal(store.clear(), 2);
  assert.deepEqual(store.list(), []);
  assert.equal(store.clear(), 0);

  // The write is in flight; the next save waits for it.
  await store.record(report({ fingerprint: 'three' }));
  assert.deepEqual(onDisk(file).map((entry) => entry.fingerprint), ['three']);
});

test('the summary covers only errors seen since the given moment', async () => {
  const store = createStore(freshFile());
  const since = Date.parse('2026-10-01T00:00:00.000Z');

  assert.deepEqual(store.summary(since), { distinct: 0, reports: 0, worst: null });

  await store.record(report({ fingerprint: 'old', message: 'old' }), at('2026-09-20T00:00:00.000Z'));
  await store.record(report({ fingerprint: 'old', message: 'old' }), at('2026-09-21T00:00:00.000Z'));
  await store.record(report({ fingerprint: 'rare', message: 'rare' }), at('2026-10-02T00:00:00.000Z'));
  for (const hour of ['01', '02', '03']) {
    await store.record(
      report({ fingerprint: 'common', message: 'common' }),
      at(`2026-10-03T${hour}:00:00.000Z`)
    );
  }

  const { distinct, reports, worst } = store.summary(since);
  assert.equal(distinct, 2);
  assert.equal(reports, 4);
  assert.equal(worst.message, 'common');
  assert.equal(worst.count, 3);
});

test('between equally frequent errors the summary names the one seen last', async () => {
  const store = createStore(freshFile());
  await store.record(report({ fingerprint: 'later', message: 'later' }), at('2026-10-03T00:00:00.000Z'));
  await store.record(report({ fingerprint: 'earlier', message: 'earlier' }), at('2026-10-02T00:00:00.000Z'));

  assert.equal(store.summary(0).worst.message, 'later');
});

test('a damaged file, or entries that are not entries, are ignored', async () => {
  const damaged = freshFile();
  mkdirSync(join(damaged, '..'), { recursive: true, mode: 0o700 });
  writeFileSync(damaged, '{ not json');
  assert.deepEqual(createStore(damaged).list(), []);

  const mixed = freshFile();
  mkdirSync(join(mixed, '..'), { recursive: true, mode: 0o700 });
  const good = { ...report({ fingerprint: 'good' }), count: 4, firstSeenAt: 'x', lastSeenAt: '2026-10-04T10:00:00.000Z' };
  writeFileSync(
    mixed,
    JSON.stringify([null, 7, 'text', {}, { fingerprint: 'no-count', message: 'm', lastSeenAt: 'x' }, good])
  );
  assert.deepEqual(createStore(mixed).list(), [good]);

  const notAList = freshFile();
  mkdirSync(join(notAList, '..'), { recursive: true, mode: 0o700 });
  writeFileSync(notAList, JSON.stringify({ fingerprint: 'x' }));
  assert.deepEqual(createStore(notAList).list(), []);
});

test('the folder and file are readable by their owner alone', { skip: process.platform === 'win32' }, async () => {
  const file = freshFile();
  await createStore(file).record(report());

  assert.equal(statSync(join(file, '..')).mode & 0o777, 0o700);
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('a folder others can write to is not used; reports stay in memory', { skip: process.platform === 'win32' }, async () => {
  const file = freshFile();
  const folder = join(file, '..');
  mkdirSync(folder, { recursive: true });
  chmodSync(folder, 0o777);
  writeFileSync(file, JSON.stringify([{ ...report({ fingerprint: 'planted' }), count: 9, lastSeenAt: '2026-10-04T10:00:00.000Z' }]));

  const store = createStore(file);
  await store.record(report({ fingerprint: 'mine' }));

  assert.deepEqual(store.list().map((entry) => entry.fingerprint), ['mine']);
  assert.equal(onDisk(file)[0].fingerprint, 'planted');
});

test('a folder that cannot be created leaves the store working in memory', async () => {
  const blocker = join(scratch, 'a-file-not-a-folder');
  writeFileSync(blocker, '');
  const file = join(blocker, 'nested', 'client-errors.json');

  const store = createStore(file);
  await store.record(report());

  assert.equal(store.list().length, 1);
  assert.equal(existsSync(file), false);
});

test('a failed write is logged and never thrown', async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const file = freshFile();
  // The target is a folder, so the rename cannot succeed.
  mkdirSync(file, { recursive: true, mode: 0o700 });
  chmodSync(join(file, '..'), 0o700);

  const store = createStore(file);
  await store.record(report());

  assert.equal(store.list().length, 1);
  assert.equal(logged.mock.callCount(), 1);
  assert.match(logged.mock.calls[0].arguments[0], /Could not save client errors/);
});
