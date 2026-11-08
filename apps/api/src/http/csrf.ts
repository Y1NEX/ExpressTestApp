import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { ApplicationError } from '../core/errors.js';

export function csrfToken(req: Request): string {
  if (!req.session.csrfToken || !/^[a-f0-9]{64}$/.test(req.session.csrfToken))
    req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

export function csrfProtection(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin)
      return next(new ApplicationError('ORIGIN_FORBIDDEN'));
    const supplied = req.get('x-csrf-token');
    const expected = req.session.csrfToken;
    if (
      !supplied ||
      !expected ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !/^[a-f0-9]{64}$/.test(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    ) {
      return next(new ApplicationError('CSRF_INVALID'));
    }
    next();
  };
}
