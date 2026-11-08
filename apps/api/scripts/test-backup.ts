import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { tca } from '@itsezz/try-catch';
import { readConfig } from '../src/config.js';

const config = readConfig();
if (
  !/^\/snippet_test_[a-f0-9]{32}$/.test(new URL(config.DATABASE_URL).pathname)
)
  throw new Error(
    'Backup verification requires the isolated integration database',
  );
const root = fileURLToPath(new URL('../../../', import.meta.url));
const client = new pg.Client({ connectionString: config.DATABASE_URL });
const id = randomUUID();
const sid = `backup-verification-${id}`;
const content = '  SELECT 1;\nUnicode: 💻 ü; literal path: C:\\tools';
let restoreName: string | undefined;
let restored: pg.Client | undefined;
const fixtures: string[] = [];

function run(
  script: string,
  args: string[] = [],
  expectedExit = 0,
  overrides: { toolArgs?: string[]; databaseUrl?: string } = {},
): string {
  const native =
    overrides.toolArgs ??
    (process.env.PG_TOOLS_BIN
      ? ['--native', '--bin-dir', process.env.PG_TOOLS_BIN]
      : []);
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../../node_modules/tsx/dist/cli.mjs', import.meta.url),
      ),
      script,
      ...native,
      ...args,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...process.env,
        ...(overrides.databaseUrl
          ? { DATABASE_URL: overrides.databaseUrl }
          : {}),
      },
    },
  );
  if (result.error) throw result.error;
  assert.equal(result.status, expectedExit, result.stderr);
  return result.stdout;
}

const result = await tca(async () => {
  await client.connect();
  const backupDirectory = resolve(root, 'backups');
  await mkdir(backupDirectory, { recursive: true });
  const filesBeforeFailure = (await readdir(backupDirectory)).sort();
  const missingTool = run('packages/database/scripts/backup.ts', [], 1, {
    toolArgs: [
      '--native',
      '--bin-dir',
      resolve(root, `.missing-pg-tools-${randomUUID()}`),
    ],
  });
  assert(!missingTool.includes('Backup created:'));
  assert.deepEqual((await readdir(backupDirectory)).sort(), filesBeforeFailure);
  const missingDatabase = new URL(config.DATABASE_URL);
  missingDatabase.pathname = `/snippet_missing_${randomUUID().replaceAll('-', '')}`;
  const failedExport = run('packages/database/scripts/backup.ts', [], 1, {
    databaseUrl: missingDatabase.toString(),
  });
  assert(!failedExport.includes('Backup created:'));
  assert.deepEqual((await readdir(backupDirectory)).sort(), filesBeforeFailure);
  await client.query(
    'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
    [id, `${id}@example.com`, 'backup-fixture-hash'],
  );
  await client.query(
    'INSERT INTO snippets(id,owner_id,title,content,category,favorite,updated_at) VALUES($1,$1,$2,$3,$4,true,now())',
    [id, 'Backup fixture', content, 'SQL'],
  );
  await client.query(
    "INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,now()+interval '1 day')",
    [sid, JSON.stringify({ passport: { user: id } })],
  );
  const output = run('packages/database/scripts/backup.ts');
  const file = output.match(/Backup created: (.+)/)?.[1]?.trim();
  assert(file, 'Expected backup path');
  fixtures.push(file, `${file}.sha256`);
  const result = run('packages/database/scripts/restore.ts', ['--file', file]);
  restoreName = result.match(
    /Created restore database: (snippets_restore_[a-f0-9]{32})/,
  )?.[1];
  assert(restoreName, 'Expected new restore database');
  assert(result.includes(`Restore complete: ${restoreName}`));
  const restoredUrl = new URL(config.DATABASE_URL);
  restoredUrl.pathname = `/${restoreName}`;
  restored = new pg.Client({ connectionString: restoredUrl.toString() });
  await restored.connect();
  const row = (
    await restored.query(
      'SELECT content,category,favorite FROM snippets WHERE id=$1',
      [id],
    )
  ).rows[0];
  assert.deepEqual(row, { content, category: 'SQL', favorite: true });
  assert.equal(
    (await restored.query('SELECT password_hash FROM users WHERE id=$1', [id]))
      .rows[0]?.password_hash,
    'backup-fixture-hash',
  );
  assert.equal(
    (await restored.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,
    0,
  );
  assert.equal(
    (await restored.query('SELECT count(*)::int AS n FROM _prisma_migrations'))
      .rows[0].n,
    (await client.query('SELECT count(*)::int AS n FROM _prisma_migrations'))
      .rows[0].n,
  );
  const corrupted = `${file}.corrupted.dump`;
  fixtures.push(corrupted, `${corrupted}.sha256`);
  await copyFile(file, corrupted);
  await writeFile(`${corrupted}.sha256`, '0'.repeat(64));
  const before = (
    await client.query('SELECT datname FROM pg_database ORDER BY datname')
  ).rows;
  run('packages/database/scripts/restore.ts', ['--file', corrupted], 1);
  assert.deepEqual(
    (await client.query('SELECT datname FROM pg_database ORDER BY datname'))
      .rows,
    before,
  );
});
const disconnectedRestore = await tca(async () => {
  if (restored) await restored.end();
});
const dropped = await tca(async () => {
  // Names are generated by this run and strictly validated before SQL interpolation.
  if (restoreName && /^snippets_restore_[a-f0-9]{32}$/.test(restoreName))
    await client.query(`DROP DATABASE "${restoreName}" WITH (FORCE)`);
});
const deleted = await Promise.all([
  tca(() => client.query('DELETE FROM users WHERE id=$1', [id])),
  tca(() => client.query('DELETE FROM sessions WHERE sid=$1', [sid])),
  ...fixtures.map((file) => tca(() => rm(file, { force: true }))),
]);
const disconnected = await tca(() => client.end());
const errors = [result, disconnectedRestore, dropped, ...deleted, disconnected]
  .filter((result) => !result.ok)
  .map((result) => result.error);
if (errors.length)
  throw new AggregateError(errors, 'Backup verification failed');
console.log(
  'Backup verification passed: missing tool and failed export leave no partial files; exact code/Unicode, metadata, user hash, migrations, empty sessions, corrupt-checksum refusal.',
);
