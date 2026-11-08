import { Passport } from 'passport';
import { Strategy } from 'passport-local';
import { tca } from '@itsezz/try-catch';
import type { PrismaClient } from '@snippet/database';
import { publicUserSchema } from '@snippet/contracts';
import {
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
} from './passwords.js';

export async function createPassport(db: PrismaClient) {
  const passport = new Passport();
  // Unknown emails still perform one slow hash verification to reduce timing differences.
  const dummyHash = await hashPassword('unused-random-login-placeholder');

  passport.use(
    new Strategy({ usernameField: 'email' }, (email, password, done) => {
      void tca(async () => {
        const user = await db.user.findUnique({ where: { email } });
        const valid = await verifyPassword(
          password,
          user?.passwordHash ?? dummyHash,
        );
        if (!user || !valid) return false;
        if (needsPasswordRehash(user.passwordHash)) {
          await db.user.updateMany({
            where: { id: user.id, passwordHash: user.passwordHash },
            data: { passwordHash: await hashPassword(password) },
          });
        }
        return { id: user.id, email: user.email };
      }).then((result) => {
        if (!result.ok) done(result.error);
        else done(null, result.data);
      });
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id: string, done) => {
    if (!publicUserSchema.shape.id.safeParse(id).success) {
      done(null, false);
      return;
    }
    void tca(() =>
      db.user.findUnique({ where: { id }, select: { id: true, email: true } }),
    ).then((result) => {
      if (!result.ok) done(result.error);
      else done(null, result.data ?? false);
    });
  });
  return passport;
}
