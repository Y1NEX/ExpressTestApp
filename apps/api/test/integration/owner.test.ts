import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@snippet/database';
import { provisionOwner } from '../../src/auth/provision-owner.js';
import { verifyPassword } from '../../src/auth/passwords.js';
import { readConfig } from '../../src/config.js';

const config = readConfig();
if (
  !/^\/snippet_test_[a-f0-9]{32}$/.test(new URL(config.DATABASE_URL).pathname)
)
  throw new Error('Isolated test database required');
const db = createDatabase(config.DATABASE_URL);
const createdIds = new Set<string>();
afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: [...createdIds] } } });
  createdIds.clear();
});
afterAll(async () => {
  await db.$disconnect();
});

describe('single owner provisioning', () => {
  it('serializes simultaneous attempts with different emails', async () => {
    expect(await db.user.count()).toBe(0);
    const results = await Promise.allSettled([
      provisionOwner(db, {
        email: 'first@example.com',
        password: 'first-password-12345',
      }),
      provisionOwner(db, {
        email: 'second@example.com',
        password: 'second-password-12345',
      }),
    ]);
    for (const result of results)
      if (result.status === 'fulfilled') createdIds.add(result.value.id);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
  });
  it('does not reset an existing password when setup is repeated', async () => {
    const first = await provisionOwner(db, {
      email: 'repeat@example.com',
      password: 'original-password-12345',
    });
    createdIds.add(first.id);
    const second = await provisionOwner(db, {
      email: ' REPEAT@EXAMPLE.COM ',
      password: 'different-password-12345',
    });
    expect(second).toEqual({ id: first.id, created: false });
    const user = await db.user.findUniqueOrThrow({ where: { id: first.id } });
    expect(
      await verifyPassword('original-password-12345', user.passwordHash),
    ).toBe(true);
    expect(
      await verifyPassword('different-password-12345', user.passwordHash),
    ).toBe(false);
  });
});
