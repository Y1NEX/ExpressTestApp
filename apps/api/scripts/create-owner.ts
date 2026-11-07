import { ownerCredentialsSchema } from '@snippet/contracts';
import { createDatabase } from '@snippet/database';
import { readConfig } from '../src/config.js';
import { hashPassword } from '../src/auth/passwords.js';

const config = readConfig();
const credentials = ownerCredentialsSchema.parse({
  email: process.env.OWNER_EMAIL,
  password: process.env.OWNER_PASSWORD,
});
const db = createDatabase(config.DATABASE_URL);
try {
  // Re-running setup must never silently reset an existing password.
  const existing = await db.user.findUnique({
    where: { email: credentials.email },
  });
  if (existing) console.log('Owner already exists; password was not changed.');
  else {
    const count = await db.user.count();
    if (count > 0)
      throw new Error(
        'A user already exists. This single-user setup will not create another owner.',
      );
    await db.user.create({
      data: {
        email: credentials.email,
        passwordHash: await hashPassword(credentials.password),
      },
    });
    console.log('Owner created.');
  }
} finally {
  await db.$disconnect();
}
