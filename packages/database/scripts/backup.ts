import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
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
try {
  if (!child.stdout) throw new Error('Backup process has no output stream');
  // Binary stream avoids PowerShell redirection corrupting a custom-format dump.
  await Promise.all([
    pipeline(child.stdout, createWriteStream(temporary, { flags: 'wx' })),
    finished(child),
  ]);
  await rename(temporary, file);
  await writeFile(`${file}.sha256`, `${await sha256(file)}\n`, { flag: 'wx' });
  console.log(`Backup created: ${file}`);
} catch (error) {
  await unlink(temporary).catch(() => {});
  throw error;
}
