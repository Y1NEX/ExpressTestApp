import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { databaseUrl, finished, pgTool, root, sha256 } from './pg-tools.js';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    native: { type: 'boolean' },
    'bin-dir': { type: 'string' },
  },
});
if (!values.file) throw new Error('Use --file backups/<name>.dump');
const file = resolve(root, values.file);
const expected = (await readFile(`${file}.sha256`, 'utf8')).trim();
if (!/^[a-f0-9]{64}$/.test(expected) || (await sha256(file)) !== expected)
  throw new Error('Backup checksum mismatch; nothing was restored');

// Restore always creates a NEW database. There is intentionally no overwrite flag.
const target = `snippets_restore_${randomUUID().replaceAll('-', '')}`;
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({
  connectionString: adminUrl.toString(),
  connectionTimeoutMillis: 5000,
});
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${target}"`);
} finally {
  await admin.end();
}
console.log(`Created restore database: ${target}`);

let child;
if (values.native) {
  child = pgTool(
    'pg_restore',
    [
      '--single-transaction',
      '--exit-on-error',
      '--no-owner',
      '--no-privileges',
      file,
    ],
    values,
    target,
  );
  child.stdout!.resume();
  await finished(child);
} else {
  // The archive stays local; send it to pg_restore in the existing DB container.
  child = spawn(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'pg_restore',
      '--username',
      decodeURIComponent(databaseUrl.username),
      '--dbname',
      target,
      '--single-transaction',
      '--exit-on-error',
      '--no-owner',
      '--no-privileges',
    ],
    { cwd: root, stdio: ['pipe', 'inherit', 'inherit'] },
  );
  await Promise.all([
    pipeline(createReadStream(file), child.stdin!),
    finished(child),
  ]);
}
console.log(`Restore complete: ${target}`);
console.log(
  'The active DATABASE_URL was not changed. Sessions are empty; log in again after switching.',
);
