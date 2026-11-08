import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
} from '../../src/auth/passwords.js';
import { scryptSync } from 'node:crypto';

describe('password hashing', () => {
  it('keeps legacy accounts usable while identifying hashes for upgrade', async () => {
    const salt = 'a'.repeat(32);
    const legacy = `scrypt:${salt}:${scryptSync('existing-password', salt, 64).toString('hex')}`;
    expect(await verifyPassword('existing-password', legacy)).toBe(true);
    expect(needsPasswordRehash(legacy)).toBe(true);
    const current = await hashPassword('existing-password');
    expect(needsPasswordRehash(current)).toBe(false);
    expect(await verifyPassword('wrong', legacy)).toBe(false);
    expect(
      await verifyPassword(
        'existing-password',
        current.replace('32768', '999999999'),
      ),
    ).toBe(false);
  });
  it('uses independent salts, validates the correct password and rejects a wrong password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).not.toBe(second);
    expect(first).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery staple', first)).toBe(
      true,
    );
    expect(await verifyPassword('wrong', first)).toBe(false);
  });
  it.each([
    '',
    'scrypt:x:y',
    'bcrypt:abc:123',
    'scrypt:' + 'a'.repeat(32) + ':' + 'x'.repeat(128),
  ])('rejects a malformed stored hash', async (hash) => {
    expect(await verifyPassword('anything', hash)).toBe(false);
  });
});
