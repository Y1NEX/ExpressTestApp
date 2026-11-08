import { createDatabase } from '@snippet/database';
import { readConfig } from '../src/config.js';
import { provisionOwner } from '../src/auth/provision-owner.js';

const config = readConfig();
const db = createDatabase(config.DATABASE_URL);
try {
  const result = await provisionOwner(db, {
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
  });
  console.log(
    result.created
      ? 'Owner created.'
      : 'Owner already exists; password was not changed.',
  );
} finally {
  await db.$disconnect();
}
