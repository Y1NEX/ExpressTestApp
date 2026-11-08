import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

function derive(
  password: string,
  salt: string,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(password, salt, 64, options, (error, value) =>
      error ? reject(error) : resolve(value),
    ),
  );
}
// OWASP's memory/CPU trade-off profile: 32 MiB, three passes.
const profile = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = 'scrypt$32768$8$3$';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, profile);
  return `${prefix}${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const legacy = storedHash.startsWith('scrypt:');
  const parts = storedHash.split(legacy ? ':' : '$');
  const salt = legacy ? parts[1] : parts[4];
  const hash = legacy ? parts[2] : parts[5];
  if (
    (legacy
      ? parts.length !== 3
      : parts.length !== 6 || !storedHash.startsWith(prefix)) ||
    !salt ||
    !hash ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(hash)
  )
    return false;
  const actual = await derive(
    password,
    salt,
    legacy ? { N: 16384, r: 8, p: 1 } : profile,
  );
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

export function needsPasswordRehash(storedHash: string): boolean {
  return !storedHash.startsWith(prefix);
}
