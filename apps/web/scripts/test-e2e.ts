import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { tca } from '@itsezz/try-catch';
import { createDatabase } from '@snippet/database';
import { preview, type PreviewServer } from 'vite';
import { readConfig } from '../../api/src/config.js';
import { startRuntime } from '../../api/src/runtime.js';
import { provisionOwner } from '../../api/src/auth/provision-owner.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const config = readConfig();
const databaseName = `snippet_web_test_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = new URL(config.DATABASE_URL);
databaseUrl.pathname = `/${databaseName}`;
const adminUrl = new URL(config.DATABASE_URL);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({
  connectionString: adminUrl.toString(),
  connectionTimeoutMillis: 5000,
});
const db = createDatabase(databaseUrl.toString());
const email = 'review@example.test';
const password = randomBytes(24).toString('hex');
const baseURL = 'http://localhost:5174';
let created = false;
let api: Awaited<ReturnType<typeof startRuntime>> | undefined;
let web: PreviewServer | undefined;

const result = await tca(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  console.log(`Created isolated browser-test database ${databaseName}`);
  const migration = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
      ),
      'migrate',
      'deploy',
      '--config',
      'packages/database/prisma.config.ts',
    ],
    {
      cwd: root,
      stdio: 'inherit',
      timeout: 60000,
      env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
    },
  );
  if (migration.error) throw migration.error;
  if (migration.status !== 0) throw new Error('Browser-test migration failed');
  await provisionOwner(db, { email, password });
  api = await startRuntime({
    ...config,
    DATABASE_URL: databaseUrl.toString(),
    SESSION_SECRET: randomBytes(48).toString('hex'),
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    PORT: 0,
    HOST: '127.0.0.1',
    WEB_ORIGIN: baseURL,
  });
  const address = api.server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP listener');
  web = await preview({
    root: webRoot,
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    preview: {
      host: 'localhost',
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${address.port}`,
          changeOrigin: false,
        },
      },
    },
  });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            '../../../node_modules/@playwright/test/cli.js',
            import.meta.url,
          ),
        ),
        'test',
        '--config',
        'apps/web/playwright.config.ts',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          E2E_BASE_URL: baseURL,
          E2E_EMAIL: email,
          E2E_PASSWORD: password,
        },
      },
    );
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Browser tests failed (exit ${code})`)),
    );
  });
});

const webClosed = await tca(async () => {
  if (web) await web.close();
});
const apiClosed = await tca(async () => {
  if (api) await api.shutdown();
});
const dbClosed = await tca(() => db.$disconnect());
const dropped = await tca(async () => {
  // Only this run's generated identifier can reach the DROP statement.
  if (created)
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
});
const adminClosed = await tca(() => admin.end());
const errors = [result, webClosed, apiClosed, dbClosed, dropped, adminClosed]
  .filter((entry) => !entry.ok)
  .map((entry) => entry.error);
if (errors.length)
  throw new AggregateError(errors, 'Browser verification failed');
console.log(
  'Browser verification passed; isolated database and servers removed.',
);
