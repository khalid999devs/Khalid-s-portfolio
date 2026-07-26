'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ProviderCapacityError,
  ProviderDeadlineError,
  createProviderExecutor,
} = require('../utils/providerExecution');

test('provider execution fails fast and retains capacity until a timed-out task really settles', async () => {
  const deadlineCallbacks = [];
  const clearedTimers = [];
  const executor = createProviderExecutor({
    clearTimeoutFn: (timer) => clearedTimers.push(timer),
    providerName: 'Test',
    setTimeoutFn: (callback) => {
      deadlineCallbacks.push(callback);
      return deadlineCallbacks.length;
    },
  });
  let operationSignal;
  let settleOperation;

  const timedOutCall = executor.execute(
    ({ signal }) => {
      operationSignal = signal;
      return new Promise((resolve) => {
        settleOperation = resolve;
      });
    },
    { capacity: 1, timeoutMs: 50 }
  );
  await Promise.resolve();

  assert.equal(executor.getActiveCount(), 1);
  deadlineCallbacks[0]();
  await assert.rejects(
    timedOutCall,
    (error) => error instanceof ProviderDeadlineError
  );
  assert.equal(operationSignal.aborted, true);
  assert.ok(operationSignal.reason instanceof ProviderDeadlineError);
  assert.equal(executor.getActiveCount(), 1);

  await assert.rejects(
    executor.execute(async () => 'should-not-run', {
      capacity: 1,
      timeoutMs: 50,
    }),
    (error) =>
      error instanceof ProviderCapacityError &&
      error.deliveryOutcome === 'not-attempted'
  );

  settleOperation('late-result');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(executor.getActiveCount(), 0);
  assert.deepEqual(clearedTimers, [1]);

  const recoveredCall = executor.execute(async () => 'accepted', {
    capacity: 1,
    timeoutMs: 50,
  });
  assert.equal(await recoveredCall, 'accepted');
  assert.equal(executor.getActiveCount(), 0);
});

test('provider deadline aborts a cooperative task and releases its slot', async () => {
  let invokeDeadline;
  const executor = createProviderExecutor({
    clearTimeoutFn() {},
    providerName: 'Test',
    setTimeoutFn: (callback) => {
      invokeDeadline = callback;
      return 1;
    },
  });

  const call = executor.execute(
    ({ signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(signal.reason),
          { once: true }
        );
      }),
    { capacity: 1, timeoutMs: 25 }
  );
  await Promise.resolve();

  invokeDeadline();
  await assert.rejects(
    call,
    (error) =>
      error instanceof ProviderDeadlineError &&
      error.deliveryOutcomeAmbiguous === true
  );
  await Promise.resolve();

  assert.equal(executor.getActiveCount(), 0);
});
