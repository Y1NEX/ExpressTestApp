import type { PrismaClient } from '@snippet/database';
import { ownerCredentialsSchema } from '@snippet/contracts';
import { ApplicationError } from '../core/errors.js';
import { hashPassword } from './passwords.js';

export async function provisionOwner(
  db: PrismaClient,
  input: unknown,
): Promise<{ id: string; created: boolean }> {
  const credentials = ownerCredentialsSchema.parse(input);
  const passwordHash = await hashPassword(credentials.password);
  return db.$transaction(
    async (transaction) => {
      // Serialize owner creation across CLI processes, including different email addresses.
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(174036, 1)::text AS lock`;
      const existing = await transaction.user.findUnique({
        where: { email: credentials.email },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
      if ((await transaction.user.count()) > 0)
        throw new ApplicationError('CONFLICT');
      const user = await transaction.user.create({
        data: { email: credentials.email, passwordHash },
        select: { id: true },
      });
      return { id: user.id, created: true };
    },
    { timeout: 10000 },
  );
}
