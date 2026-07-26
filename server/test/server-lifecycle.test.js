'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const express = require('express');

const { createHealthRouter } = require('../index');
const {
  closeDatabaseConnection,
  closeHttpServer,
  createShutdownManager,
} = require('../utils/serverLifecycle');

const listen = async (app) => {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1');
    instance.once('error', reject);
    instance.once('listening', () => resolve(instance));
  });
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

test('health endpoints expose only stable status and readiness fails closed', async (t) => {
  let ready = true;
  const app = express();
  app.use(
    '/health',
    createHealthRouter({
      readinessCheck: async () => {
        if (!ready) {
          throw new Error('database password=must-never-be-returned');
        }
      },
    })
  );
  const server = await listen(app);
  t.after(server.close);

  const live = await fetch(`${server.baseUrl}/health/live`);
  assert.equal(live.status, 200);
  assert.equal(live.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await live.json(), { status: 'ok' });

  const healthy = await fetch(`${server.baseUrl}/health/ready`);
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { status: 'ready' });

  ready = false;
  const unavailable = await fetch(`${server.baseUrl}/health/ready`);
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { status: 'unavailable' });
});

test('graceful shutdown is idempotent, drains HTTP, and closes Sequelize', async () => {
  const events = [];
  const exitCodes = [];
  const processTarget = new EventEmitter();
  processTarget.exit = (code) => exitCodes.push(code);
  const lifecycleState = { isShuttingDown: false };
  const server = {
    close(callback) {
      events.push('http:close');
      setImmediate(callback);
    },
    closeIdleConnections() {
      events.push('http:close-idle');
    },
  };
  const sequelize = {
    async close() {
      events.push('sequelize:close');
    },
  };
  const manager = createShutdownManager({
    closeMailTransporter() {
      events.push('mail:close');
    },
    lifecycleState,
    processTarget,
    sequelize,
    server,
    timeoutMs: 1_000,
  });

  assert.equal(processTarget.listenerCount('SIGINT'), 1);
  assert.equal(processTarget.listenerCount('SIGTERM'), 1);

  const firstShutdown = manager.shutdown();
  const repeatedShutdown = manager.shutdown();
  assert.equal(firstShutdown, repeatedShutdown);
  assert.equal(lifecycleState.isShuttingDown, true);
  await firstShutdown;

  assert.deepEqual(events, [
    'http:close',
    'http:close-idle',
    'mail:close',
    'sequelize:close',
  ]);
  assert.equal(processTarget.listenerCount('SIGINT'), 0);
  assert.equal(processTarget.listenerCount('SIGTERM'), 0);
  assert.deepEqual(exitCodes, []);
});

test('database shutdown rejects within its configured deadline', async () => {
  const startedAt = Date.now();

  await assert.rejects(
    closeDatabaseConnection(
      {
        close: () => new Promise(() => {}),
      },
      20
    ),
    /Database connection did not close within 20 milliseconds/
  );

  assert.ok(Date.now() - startedAt < 1_000);
});

test('HTTP force-close failures reject in a controlled aggregate', async () => {
  const forceCloseError = new Error('force-close failed');

  await assert.rejects(
    closeHttpServer(
      {
        close() {},
        closeAllConnections() {
          throw forceCloseError;
        },
      },
      5
    ),
    (error) =>
      error instanceof AggregateError &&
      error.errors.some((item) => item === forceCloseError) &&
      error.errors.some((item) => /did not drain/u.test(item.message))
  );
});

test('graceful shutdown passes only the remaining monotonic deadline to database cleanup', async () => {
  const processTarget = new EventEmitter();
  const lifecycleState = { isShuttingDown: false };
  const cleanupBudgets = [];
  let currentTime = 1_000;
  const manager = createShutdownManager({
    closeDatabaseConnectionFn: async (_sequelize, remainingMs) => {
      cleanupBudgets.push(['database', remainingMs]);
    },
    closeHttpServerFn: async (_server, remainingMs) => {
      cleanupBudgets.push(['http', remainingMs]);
      currentTime += 75;
      throw new Error('HTTP close failed');
    },
    lifecycleState,
    now: () => currentTime,
    processTarget,
    sequelize: {},
    server: {},
    timeoutMs: 100,
  });

  await assert.rejects(
    () => manager.shutdown(),
    (error) =>
      error instanceof AggregateError &&
      error.errors.length === 1 &&
      error.errors[0].message === 'HTTP close failed'
  );

  assert.deepEqual(cleanupBudgets, [
    ['http', 100],
    ['database', 25],
  ]);
});

test('a second termination signal forces exit during graceful shutdown', async () => {
  const processTarget = new EventEmitter();
  const exitCodes = [];
  const loggedErrors = [];
  processTarget.exit = (code) => exitCodes.push(code);
  const manager = createShutdownManager({
    closeDatabaseConnectionFn: async () => {},
    closeHttpServerFn: async () => {
      throw new Error('HTTP server did not drain');
    },
    lifecycleState: { isShuttingDown: false },
    logger: { error: (message) => loggedErrors.push(message) },
    processTarget,
    sequelize: {},
    server: {},
    timeoutMs: 1_000,
  });

  processTarget.emit('SIGTERM');
  processTarget.emit('SIGTERM');

  assert.deepEqual(exitCodes, [1]);
  assert.match(loggedErrors[0], /forcing process exit/u);
  await assert.rejects(
    () => manager.shutdown(),
    (error) =>
      error instanceof AggregateError &&
      error.errors.some((item) => /did not drain/u.test(item.message))
  );
});

test('a first-signal shutdown failure exits with status one', async () => {
  const processTarget = new EventEmitter();
  const exitCodes = [];
  processTarget.exit = (code) => exitCodes.push(code);
  const manager = createShutdownManager({
    closeDatabaseConnectionFn: async () => {},
    closeHttpServerFn: async () => {
      throw new Error('HTTP close failed');
    },
    lifecycleState: { isShuttingDown: false },
    logger: { error() {} },
    processTarget,
    sequelize: {},
    server: {},
    timeoutMs: 1_000,
  });

  processTarget.emit('SIGTERM');
  await assert.rejects(() => manager.shutdown(), /Graceful shutdown failed/u);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(exitCodes, [1]);
});

test('the first-signal watchdog forces exit at the absolute deadline', () => {
  const processTarget = new EventEmitter();
  const exitCodes = [];
  const loggedErrors = [];
  let watchdog;
  processTarget.exit = (code) => exitCodes.push(code);
  createShutdownManager({
    closeHttpServerFn: () => new Promise(() => {}),
    lifecycleState: { isShuttingDown: false },
    logger: { error: (message) => loggedErrors.push(message) },
    processTarget,
    sequelize: {},
    server: {},
    setTimeoutFn(callback, timeoutMs) {
      assert.equal(timeoutMs, 1_000);
      watchdog = callback;
      return 1;
    },
    timeoutMs: 1_000,
  });

  processTarget.emit('SIGTERM');
  watchdog();

  assert.deepEqual(exitCodes, [1]);
  assert.match(loggedErrors[0], /exceeded 1000 milliseconds/u);
});

test('SIGTERM completes cleanup and exits with status zero', async () => {
  const processTarget = new EventEmitter();
  const lifecycleState = { isShuttingDown: false };
  const exitCodes = [];
  let databaseClosed = false;
  processTarget.exit = (code) => exitCodes.push(code);
  const manager = createShutdownManager({
    lifecycleState,
    logger: { error() {} },
    processTarget,
    sequelize: {
      async close() {
        databaseClosed = true;
      },
    },
    server: {
      close(callback) {
        setImmediate(callback);
      },
    },
    timeoutMs: 1_000,
  });

  processTarget.emit('SIGTERM');
  await manager.shutdown();

  assert.equal(lifecycleState.isShuttingDown, true);
  assert.equal(databaseClosed, true);
  assert.deepEqual(exitCodes, [0]);
});
