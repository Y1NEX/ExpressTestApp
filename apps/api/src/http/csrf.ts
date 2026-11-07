import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { HttpError } from './errors.js';

export function csrfToken(req: Request): string {
  req.session.csrfToken ??= randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

export function csrfProtection(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin)
      return next(
        new HttpError(403, 'ORIGIN_FORBIDDEN', 'Origin is not allowed'),
      );
    const supplied = req.get('x-csrf-token');
    const expected = req.session.csrfToken;
    if (
      !supplied ||
      !expected ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    ) {
      return next(
        new HttpError(
          403,
          'CSRF_INVALID',
          'Fetch a CSRF token and send it as X-CSRF-Token',
        ),
      );
    }
    next();
  };
}
