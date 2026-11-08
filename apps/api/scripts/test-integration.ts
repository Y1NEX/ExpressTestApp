import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { tca } from '@itsezz/try-catch';
import { readConfig } from '../src/config.js';

const config = readConfig();
const root = fileURLToPath(new URL('../../../', import.meta.url));
const databaseName = `snippet_test_${randomUUID().replaceAll('-', '')}`;
const adminUrl = new URL(config.DATABASE_URL);
adminUrl.pathname = '/postgres';
const testUrl = new URL(config.DATABASE_URL);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({
  connectionString: adminUrl.toString(),
  connectionTimeoutMillis: 5000,
});

function run(script: string, args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: testUrl.toString(),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Test subprocess failed (exit ${result.status})`);
}

let created = false;
const result = await tca(async () => {
  await admin.connect();
  // The identifier is generated here, never taken from environment or user input.
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  console.log(`Created isolated database ${databaseName}`);
  run(
    fileURLToPath(
      new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
    ),
    [
      'migrate',
      'deploy',
      '--config',
      fileURLToPath(
        new URL('../../../packages/database/prisma.config.ts', import.meta.url),
      ),
    ],
  );
  run(
    fileURLToPath(
      new URL('../../../node_modules/vitest/vitest.mjs', import.meta.url),
    ),
    [
      'run',
      '--config',
      fileURLToPath(
        new URL('../vitest.integration.config.ts', import.meta.url),
      ),
    ],
  );
  run(
    fileURLToPath(
      new URL('../../../node_modules/tsx/dist/cli.mjs', import.meta.url),
    ),
    [fileURLToPath(new URL('./test-backup.ts', import.meta.url))],
  );
});
const cleanup = await tca(async () => {
  if (created) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    console.log('Removed isolated test database.');
  }
});
const disconnected = await tca(() => admin.end());
const errors = [result, cleanup, disconnected]
  .filter((result) => !result.ok)
  .map((result) => result.error);
if (errors.length)
  throw new AggregateError(errors, 'Integration verification failed');
