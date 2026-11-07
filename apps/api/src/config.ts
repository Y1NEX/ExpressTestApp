import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const envSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((value) =>
      ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    ),
  SESSION_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) => !value.startsWith('replace-'),
      'Replace the example SESSION_SECRET',
    ),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z
    .url()
    .default('http://localhost:5173')
    .refine((value) => {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && value === url.origin;
    }, 'WEB_ORIGIN must be an HTTP(S) origin without a path or trailing slash'),
});

export function readConfig(environment = process.env) {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) {
    // Never print input values: configuration can contain secrets.
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return parsed.data;
}

export type Config = ReturnType<typeof readConfig>;
