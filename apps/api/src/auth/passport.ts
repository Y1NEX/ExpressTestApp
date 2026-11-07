import { Passport } from 'passport';
import { Strategy } from 'passport-local';
import type { PrismaClient } from '@snippet/database';
import { hashPassword, verifyPassword } from './passwords.js';

export async function createPassport(db: PrismaClient) {
  const passport = new Passport();
  // Unknown emails still perform one slow hash verification to reduce timing differences.
  const dummyHash = await hashPassword('unused-random-login-placeholder');

  passport.use(
    new Strategy({ usernameField: 'email' }, (email, password, done) => {
      void (async () => {
        const user = await db.user.findUnique({ where: { email } });
        const valid = await verifyPassword(
          password,
          user?.passwordHash ?? dummyHash,
        );
        if (!user || !valid) return done(null, false);
        done(null, { id: user.id, email: user.email });
      })().catch(done);
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id: string, done) => {
    void db.user
      .findUnique({ where: { id }, select: { id: true, email: true } })
      .then((user) => done(null, user ?? false))
      .catch(done);
  });
  return passport;
}
