import { createDatabase } from '@snippet/database';
import { createApp } from './app.js';
import { readConfig } from './config.js';

const config = readConfig();
const db = createDatabase(config.DATABASE_URL);
await db.$connect();
const application = await createApp(db, config);
const server = application.app.listen(config.PORT, config.HOST, () => {
  console.log(`Snippet API listening on http://${config.HOST}:${config.PORT}`);
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    try {
      await application.close();
      await db.$disconnect();
      clearTimeout(timeout);
    } catch (error) {
      console.error('Shutdown failed', error);
      process.exitCode = 1;
    }
  });
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
