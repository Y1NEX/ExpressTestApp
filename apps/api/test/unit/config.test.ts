import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/config.js';

const valid = {
  DATABASE_URL: 'postgresql://localhost/snippets',
  SESSION_SECRET: 'a'.repeat(48),
};
describe('configuration', () => {
  it('defaults to loopback and development', () => {
    expect(readConfig(valid)).toMatchObject({
      HOST: '127.0.0.1',
      PORT: 3000,
      NODE_ENV: 'development',
    });
  });
  it.each([
    { SESSION_SECRET: 'short' },
    { SESSION_SECRET: 'replace-with-example-secret-that-is-long' },
    { DATABASE_URL: 'https://example.com' },
    { PORT: '0' },
    { WEB_ORIGIN: 'http://localhost:5173/' },
    { WEB_ORIGIN: 'ftp://example.com' },
  ])('rejects invalid configuration', (input) =>
    expect(() => readConfig({ ...valid, ...input })).toThrow(
      'Invalid environment',
    ),
  );
});
