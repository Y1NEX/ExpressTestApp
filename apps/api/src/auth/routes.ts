import { Router } from 'express';
import type { createPassport } from './passport.js';
import { rateLimit } from 'express-rate-limit';
import {
  loginSchema,
  csrfResponseSchema,
  loginResponseSchema,
  userResponseSchema,
} from '@snippet/contracts';
import { ApplicationError } from '../core/errors.js';
import { csrfToken } from '../http/csrf.js';
import { authenticatedUser, requireAuth } from './require-auth.js';
import { respond } from '../http/respond.js';
import { asyncHandler } from '../http/async-handler.js';

export function authRoutes(
  passport: Awaited<ReturnType<typeof createPassport>>,
) {
  const router = Router();
  router.get('/csrf', (req, res) =>
    respond(res, csrfResponseSchema, { csrfToken: csrfToken(req) }),
  );

  router.post(
    '/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      handler: (_req, _res, next) => next(new ApplicationError('RATE_LIMITED')),
    }),
    asyncHandler(async (req, res) => {
      req.body = loginSchema.parse(req.body);
      const user = await new Promise<Express.User | false>(
        (resolve, reject) => {
          passport.authenticate(
            'local',
            (error: unknown, authenticated: Express.User | false) => {
              if (error) reject(error);
              else resolve(authenticated);
            },
          )(req, res, reject);
        },
      );
      if (!user) throw new ApplicationError('INVALID_CREDENTIALS');
      // Passport regenerates the session on login, preventing session fixation.
      await new Promise<void>((resolve, reject) =>
        req.logIn(user, (error) => (error ? reject(error) : resolve())),
      );
      const token = csrfToken(req);
      await new Promise<void>((resolve, reject) =>
        req.session.save((error) => (error ? reject(error) : resolve())),
      );
      respond(res, loginResponseSchema, { user, csrfToken: token });
    }),
  );

  router.get('/me', requireAuth, (req, res) =>
    respond(res, userResponseSchema, { user: authenticatedUser(req) }),
  );
  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      await new Promise<void>((resolve, reject) =>
        req.logout((error) => (error ? reject(error) : resolve())),
      );
      await new Promise<void>((resolve, reject) =>
        req.session.destroy((error) => (error ? reject(error) : resolve())),
      );
      res.clearCookie('snippet.sid', { path: '/' });
      res.status(204).end();
    }),
  );
  return router;
}
