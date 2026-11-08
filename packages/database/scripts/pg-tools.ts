import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { z } from 'zod';

export const root = fileURLToPath(new URL('../../../', import.meta.url));
config({ path: resolve(root, '.env'), quiet: true });
const connection = z
  .url()
  .refine((value) =>
    ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
  )
  .parse(process.env.DATABASE_URL);
export const databaseUrl = new URL(connection);
export const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
if (!databaseName) throw new Error('DATABASE_URL must name a database');

export type ToolOptions = { native?: boolean; 'bin-dir'?: string };

export function pgTool(
  tool: 'pg_dump' | 'pg_restore',
  args: string[],
  options: ToolOptions,
  targetDatabase = databaseName,
) {
  const common = [
    '--username',
    decodeURIComponent(databaseUrl.username),
    '--dbname',
    targetDatabase,
    ...args,
  ];
  if (!options.native) {
    return spawn('docker', ['compose', 'exec', '-T', 'db', tool, ...common], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  }
  const executable = options['bin-dir']
    ? resolve(
        root,
        options['bin-dir'],
        tool + (process.platform === 'win32' ? '.exe' : ''),
      )
    : tool;
  return spawn(executable, common, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
    env: {
      ...process.env,
      PGHOST: databaseUrl.hostname,
      PGPORT: databaseUrl.port || '5432',
      PGPASSWORD: decodeURIComponent(databaseUrl.password),
    },
  });
}

export function finished(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`PostgreSQL tool failed (exit ${code})`)),
    );
  });
}

export async function sha256(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
