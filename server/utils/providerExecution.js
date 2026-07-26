'use strict';

class ProviderCapacityError extends Error {
  constructor(providerName) {
    super(`${providerName} provider capacity is temporarily exhausted.`);
    this.name = 'ProviderCapacityError';
    this.code = 'PROVIDER_CAPACITY_EXCEEDED';
    this.statusCode = 503;
    this.deliveryOutcome = 'not-attempted';
    this.deliveryOutcomeAmbiguous = false;
  }
}

class ProviderDeadlineError extends Error {
  constructor(providerName, timeoutMs) {
    super(
      `${providerName} provider operation exceeded ${timeoutMs} milliseconds.`
    );
    this.name = 'ProviderDeadlineError';
    this.code = 'PROVIDER_DEADLINE_EXCEEDED';
    this.statusCode = 504;
    this.deliveryOutcome = 'unknown';
    this.deliveryOutcomeAmbiguous = true;
  }
}

const assertPositiveInteger = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
};

/**
 * Execute provider calls without an in-memory backlog.
 *
 * The caller-facing promise observes an absolute deadline. A timed-out task
 * keeps occupying its slot until the underlying operation actually settles,
 * preventing ignored aborts from creating an unbounded set of zombie calls.
 */
const createProviderExecutor = ({
  clearTimeoutFn = clearTimeout,
  providerName,
  setTimeoutFn = setTimeout,
}) => {
  if (typeof providerName !== 'string' || !providerName.trim()) {
    throw new TypeError('providerName is required.');
  }

  let activeCount = 0;

  const execute = (task, { capacity, timeoutMs }) => {
    if (typeof task !== 'function') {
      return Promise.reject(new TypeError('Provider task must be a function.'));
    }
    assertPositiveInteger(capacity, 'capacity');
    assertPositiveInteger(timeoutMs, 'timeoutMs');

    if (activeCount >= capacity) {
      return Promise.reject(new ProviderCapacityError(providerName));
    }

    activeCount += 1;
    const controller = new AbortController();
    let released = false;
    let timeout;

    const release = () => {
      if (released) return;
      released = true;
      activeCount -= 1;
    };

    const deadlinePromise = new Promise((_, reject) => {
      timeout = setTimeoutFn(() => {
        const error = new ProviderDeadlineError(providerName, timeoutMs);
        controller.abort(error);
        reject(error);
      }, timeoutMs);
    });

    const operationPromise = Promise.resolve().then(() =>
      task({ signal: controller.signal })
    );

    // Deliberately release on the underlying task, not Promise.race. If a
    // provider ignores cancellation after the public deadline, capacity stays
    // fail-closed until that real operation ends.
    operationPromise.then(release, release);

    return Promise.race([operationPromise, deadlinePromise]).finally(() => {
      clearTimeoutFn(timeout);
    });
  };

  return {
    execute,
    getActiveCount: () => activeCount,
  };
};

module.exports = {
  ProviderCapacityError,
  ProviderDeadlineError,
  createProviderExecutor,
};
