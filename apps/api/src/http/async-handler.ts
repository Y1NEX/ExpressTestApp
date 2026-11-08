import { tca } from '@itsezz/try-catch';
import type { Request, RequestHandler, Response } from 'express';
import { ApplicationError } from '../core/errors.js';

export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return async (req, res, next) => {
    const result = await tca(() => handler(req, res));
    if (!result.ok)
      next(
        result.error instanceof Error
          ? result.error
          : new ApplicationError('INTERNAL_ERROR'),
      );
  };
}
