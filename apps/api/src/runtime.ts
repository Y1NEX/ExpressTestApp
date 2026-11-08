import { createServer } from 'node:http';
import { tca } from '@itsezz/try-catch';
import { createDatabase } from '@snippet/database';
import type { Config } from './config.js';
import { createApp } from './app.js';
import { createLogger, type Logger } from './core/logger.js';

export async function startRuntime(
  config: Config,
  logger: Logger = createLogger(config.LOG_LEVEL),
) {
  const db = createDatabase(config.DATABASE_URL);
  const connected = await tca(async () => {
    await db.$connect();
    await db.$queryRaw`SELECT 1`;
  });
  if (!connected.ok) {
    await db.$disconnect();
    throw connected.error;
  }
  const initialized = await tca(() => createApp(db, config, logger));
  if (!initialized.ok) {
    await db.$disconnect();
    throw initialized.error;
  }
  const application = initialized.data;
  const server = createServer(
    { requestTimeout: 15000, headersTimeout: 10000, keepAliveTimeout: 5000 },
    application.app,
  );
  const listening = await tca(
    () =>
      new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once('error', onError);
        server.listen(config.PORT, config.HOST, () => {
          server.off('error', onError);
          resolve();
        });
      }),
  );
  if (!listening.ok) {
    await Promise.allSettled([application.close(), db.$disconnect()]);
    throw listening.error;
  }
  let shutdown: Promise<void> | undefined;
  return {
    server,
    shutdown() {
      if (shutdown) return shutdown;
      application.drain();
      shutdown = (async () => {
        const closed = await tca(
          () =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        );
        const results = await Promise.allSettled([
          application.close(),
          db.$disconnect(),
        ]);
        if (!closed.ok) throw closed.error;
        const errors = results
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason);
        if (errors.length)
          throw new AggregateError(errors, 'Resource shutdown failed');
      })();
      return shutdown;
    },
  };
}
