import { tc, tca } from '@itsezz/try-catch';
import { readConfig } from './config.js';
import { createLogger, errorDiagnostics } from './core/logger.js';
import { startRuntime } from './runtime.js';

const configuration = tc(() => readConfig());
const logger = createLogger(
  configuration.ok ? configuration.data.LOG_LEVEL : 'error',
);
if (!configuration.ok) {
  // readConfig intentionally builds this message without configuration values.
  logger.error('server.config_invalid', {
    reason:
      configuration.error instanceof Error
        ? configuration.error.message
        : 'Invalid configuration',
  });
  process.exitCode = 1;
} else {
  const config = configuration.data;
  const started = await tca(() => startRuntime(config, logger));
  if (!started.ok) {
    logger.error('server.start_failed', errorDiagnostics(started.error));
    process.exitCode = 1;
  } else {
    const runtime = started.data;
    logger.info('server.listening', { host: config.HOST, port: config.PORT });

    let closing = false;
    function shutdown() {
      if (closing) return;
      closing = true;
      const timeout = setTimeout(() => {
        logger.error('server.shutdown_timeout');
        runtime.server.closeAllConnections();
        process.exit(1);
      }, 10000).unref();
      void tca(() => runtime.shutdown()).then((result) => {
        clearTimeout(timeout);
        if (!result.ok) {
          logger.error(
            'server.shutdown_failed',
            errorDiagnostics(result.error),
          );
          process.exitCode = 1;
        } else logger.info('server.stopped');
      });
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}
