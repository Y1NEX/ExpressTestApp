import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { tca } from '@itsezz/try-catch';
import { finished, pgTool, root, sha256 } from './pg-tools.js';

const { values } = parseArgs({
  options: { native: { type: 'boolean' }, 'bin-dir': { type: 'string' } },
});
await mkdir(resolve(root, 'backups'), { recursive: true });
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const file = resolve(
  root,
  'backups',
  `snippets-${stamp}-${randomUUID().slice(0, 8)}.dump`,
);
const temporary = `${file}.partial`;
const result = await tca(async () => {
  const child = pgTool(
    'pg_dump',
    [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--exclude-table-data=public.sessions',
    ],
    values,
  );
  const stream = child.stdout;
  if (!stream) throw new Error('Backup process has no output stream');
  // Binary stream avoids PowerShell redirection corrupting a custom-format dump.
  // Wait for both results before removing a partial file, including on Windows.
  const dumped = await Promise.all([
    tca(() => pipeline(stream, createWriteStream(temporary, { flags: 'wx' }))),
    tca(() => finished(child)),
  ]);
  const errors = dumped
    .filter((result) => !result.ok)
    .map((result) => result.error);
  if (errors.length) throw new AggregateError(errors, 'Backup export failed');
  await rename(temporary, file);
  await writeFile(`${file}.sha256`, `${await sha256(file)}\n`, { flag: 'wx' });
});
if (!result.ok) {
  const cleanup = await tca(() => rm(temporary, { force: true }));
  if (!cleanup.ok)
    throw new AggregateError(
      [result.error, cleanup.error],
      'Backup and partial-file cleanup failed',
    );
  throw result.error;
}
console.log(`Backup created: ${file}`);
