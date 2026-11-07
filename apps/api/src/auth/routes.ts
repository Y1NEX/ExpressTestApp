import { Router, type RequestHandler } from 'express';
import type { createPassport } from './passport.js';
import { rateLimit } from 'express-rate-limit';
import { loginSchema } from '@snippet/contracts';
import { HttpError } from '../http/errors.js';
import { csrfToken } from '../http/csrf.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.isAuthenticated())
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in'));
  next();
};

export function authRoutes(
  passport: Awaited<ReturnType<typeof createPassport>>,
) {
  const router = Router();
  router.get('/csrf', (req, res) => res.json({ csrfToken: csrfToken(req) }));

  router.post(
    '/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many failed login attempts; try again later',
          },
        });
      },
    }),
    (req, res, next) => {
      req.body = loginSchema.parse(req.body);
      passport.authenticate(
        'local',
        (error: unknown, user: Express.User | false) => {
          if (error) return next(error);
          if (!user)
            return next(
              new HttpError(
                401,
                'INVALID_CREDENTIALS',
                'Email or password is incorrect',
              ),
            );
          // Passport regenerates the session on login, preventing session fixation.
          req.logIn(user, (loginError) => {
            if (loginError) return next(loginError);
            const token = csrfToken(req);
            req.session.save((saveError) => {
              if (saveError) return next(saveError);
              res.json({ user, csrfToken: token });
            });
          });
        },
      )(req, res, next);
    },
  );

  router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
  router.post('/logout', requireAuth, (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy((destroyError) => {
        if (destroyError) return next(destroyError);
        res.clearCookie('snippet.sid', { path: '/' });
        res.status(204).end();
      });
    });
  });
  return router;
}
