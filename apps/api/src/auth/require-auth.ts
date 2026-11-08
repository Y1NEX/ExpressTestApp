import type { Request, RequestHandler } from 'express';
import type { PublicUser } from '@snippet/contracts';
import { ApplicationError } from '../core/errors.js';

export function authenticatedUser(req: Request): PublicUser {
  if (!req.isAuthenticated() || !req.user)
    throw new ApplicationError('UNAUTHENTICATED');
  return req.user;
}
export const requireAuth: RequestHandler = (req, _res, next) => {
  authenticatedUser(req);
  next();
};
