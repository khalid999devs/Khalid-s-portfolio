'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const express = require('express');

const { createHealthRouter } = require('../index');
const {
  closeDatabaseConnection,
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
  const processTarget = new EventEmitter();
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

test('SIGTERM triggers the same graceful shutdown path', async () => {
  const processTarget = new EventEmitter();
  const lifecycleState = { isShuttingDown: false };
  let databaseClosed = false;
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
});
