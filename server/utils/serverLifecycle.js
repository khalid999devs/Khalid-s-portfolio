'use strict';

const { performance } = require('node:perf_hooks');

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
const monotonicNow = () => performance.now();

const closeHttpServer = (server, timeoutMs) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let timeout;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    timeout = setTimeout(() => {
      if (settled) return;
      // Mark the operation settled before force-closing. Node may invoke the
      // original close callback synchronously while connections are destroyed.
      settled = true;
      clearTimeout(timeout);

      const timeoutError = new Error(
        `HTTP server did not drain within ${timeoutMs} milliseconds`
      );
      let forceCloseError;
      try {
        server.closeAllConnections?.();
      } catch (error) {
        forceCloseError = error;
      }

      if (forceCloseError) {
        reject(
          new AggregateError(
            [timeoutError, forceCloseError],
            'HTTP server drain deadline elapsed and force-close failed'
          )
        );
        return;
      }

      reject(timeoutError);
    }, timeoutMs);
    timeout.unref?.();

    try {
      server.close(finish);
      server.closeIdleConnections?.();
    } catch (error) {
      finish(error);
    }
  });

const closeDatabaseConnection = (sequelize, timeoutMs) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      finish(
        new Error(
          `Database connection did not close within ${timeoutMs} milliseconds`
        )
      );
    }, timeoutMs);

    Promise.resolve()
      .then(() => sequelize.close())
      .then(() => finish(), finish);
  });

const createShutdownManager = ({
  clearTimeoutFn = clearTimeout,
  closeDatabaseConnectionFn = closeDatabaseConnection,
  closeHttpServerFn = closeHttpServer,
  closeMailTransporter = () => {},
  lifecycleState,
  logger = console,
  now = monotonicNow,
  processTarget = process,
  sequelize,
  server,
  setTimeoutFn = setTimeout,
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
}) => {
  let shutdownPromise;
  let exitRequested = false;
  let signalShutdownStarted = false;
  let signalWatchdog;
  const signalHandlers = new Map();

  const requestProcessExit = (code) => {
    if (exitRequested) return;
    exitRequested = true;
    processTarget.exitCode = code;
    processTarget.exit?.(code);
  };

  const clearSignalWatchdog = () => {
    if (signalWatchdog === undefined) return;
    clearTimeoutFn(signalWatchdog);
    signalWatchdog = undefined;
  };

  const removeSignalHandlers = () => {
    for (const [signal, handler] of signalHandlers) {
      processTarget.off(signal, handler);
    }
    signalHandlers.clear();
  };

  const shutdown = () => {
    lifecycleState.isShuttingDown = true;
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      const errors = [];
      const deadline = now() + timeoutMs;
      const remainingTime = () =>
        Math.max(0, Math.floor(deadline - now()));

      try {
        await closeHttpServerFn(server, remainingTime());
      } catch (error) {
        errors.push(error);
      }

      try {
        closeMailTransporter();
      } catch (error) {
        errors.push(error);
      }

      try {
        await closeDatabaseConnectionFn(sequelize, remainingTime());
      } catch (error) {
        errors.push(error);
      } finally {
        removeSignalHandlers();
      }

      if (errors.length) {
        throw new AggregateError(errors, 'Graceful shutdown failed');
      }
    })();

    return shutdownPromise;
  };

  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => {
      if (signalShutdownStarted || shutdownPromise) {
        logger.error(
          `Received ${signal} during graceful shutdown; forcing process exit.`
        );
        requestProcessExit(1);
        return;
      }

      signalShutdownStarted = true;
      signalWatchdog = setTimeoutFn(() => {
        logger.error(
          `Graceful shutdown exceeded ${timeoutMs} milliseconds; forcing process exit.`
        );
        requestProcessExit(1);
      }, timeoutMs);

      shutdown().then(
        () => {
          clearSignalWatchdog();
          requestProcessExit(0);
        },
        (error) => {
          clearSignalWatchdog();
          logger.error(`Graceful shutdown failed: ${error.message}`);
          requestProcessExit(1);
        }
      );
    };
    signalHandlers.set(signal, handler);
    processTarget.on(signal, handler);
  }

  return {
    removeSignalHandlers,
    shutdown,
  };
};

module.exports = {
  closeDatabaseConnection,
  closeHttpServer,
  createShutdownManager,
};
