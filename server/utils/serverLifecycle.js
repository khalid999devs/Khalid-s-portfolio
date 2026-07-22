'use strict';

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

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
      settled = true;
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      reject(
        new Error(`HTTP server did not drain within ${timeoutMs} milliseconds`)
      );
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
  closeMailTransporter = () => {},
  lifecycleState,
  logger = console,
  processTarget = process,
  sequelize,
  server,
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
}) => {
  let shutdownPromise;
  const signalHandlers = new Map();

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
      try {
        await closeHttpServer(server, timeoutMs);
      } catch (error) {
        errors.push(error);
      }

      try {
        closeMailTransporter();
      } catch (error) {
        errors.push(error);
      }

      try {
        await closeDatabaseConnection(sequelize, timeoutMs);
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
      shutdown().catch((error) => {
        logger.error(`Graceful shutdown failed: ${error.message}`);
        processTarget.exitCode = 1;
      });
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
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  closeDatabaseConnection,
  closeHttpServer,
  createShutdownManager,
};
