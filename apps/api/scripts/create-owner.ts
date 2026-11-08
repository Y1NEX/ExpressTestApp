import { createDatabase } from '@snippet/database';
import { tca } from '@itsezz/try-catch';
import { readConfig } from '../src/config.js';
import { provisionOwner } from '../src/auth/provision-owner.js';

const config = readConfig();
const db = createDatabase(config.DATABASE_URL);
const result = await tca(() =>
  provisionOwner(db, {
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
  }),
);
const disconnected = await tca(() => db.$disconnect());
const errors = [result, disconnected]
  .filter((result) => !result.ok)
  .map((result) => result.error);
if (errors.length)
  throw new AggregateError(errors, 'Owner provisioning failed');
if (result.ok) {
  console.log(
    result.data.created
      ? 'Owner created.'
      : 'Owner already exists; password was not changed.',
  );
}
