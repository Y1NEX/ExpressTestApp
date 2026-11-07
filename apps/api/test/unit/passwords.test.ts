import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/passwords.js';

describe('password hashing', () => {
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
