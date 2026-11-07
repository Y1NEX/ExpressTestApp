import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
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
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl.toString() },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Test subprocess failed (exit ${result.status})`);
}

let created = false;
try {
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
} finally {
  try {
    if (created) {
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      console.log('Removed isolated test database.');
    }
  } finally {
    await admin.end();
  }
}
