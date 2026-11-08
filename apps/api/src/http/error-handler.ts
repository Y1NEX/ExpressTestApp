import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@snippet/contracts';
import { ApplicationError } from '../core/errors.js';
import type { Logger } from '../core/logger.js';
import { errorDiagnostics } from '../core/logger.js';
import { mapPrismaError } from './prisma-errors.js';

export function normalizeError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) return error;
  if (error instanceof ZodError)
    return new ApplicationError(
      'VALIDATION_ERROR',
      error.issues.map(({ path, message }) => ({
        path: path.map((part) =>
          typeof part === 'symbol' ? String(part) : part,
        ),
        message,
      })),
    );
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 400 &&
    'code' in error &&
    ['Z_DATA_ERROR', 'Z_BUF_ERROR'].includes(String(error.code))
  )
    return new ApplicationError('BAD_REQUEST');
  if (error && typeof error === 'object' && 'type' in error) {
    switch (error.type) {
      case 'entity.parse.failed':
        return new ApplicationError('INVALID_JSON');
      case 'entity.too.large':
        return new ApplicationError('BODY_TOO_LARGE');
      case 'charset.unsupported':
        return new ApplicationError('UNSUPPORTED_MEDIA_TYPE');
      case 'encoding.unsupported':
        return new ApplicationError('UNSUPPORTED_ENCODING');
      case 'request.aborted':
      case 'request.size.invalid':
        return new ApplicationError('BAD_REQUEST');
    }
  }
  return mapPrismaError(error) ?? new ApplicationError('INTERNAL_ERROR');
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    const normalized = normalizeError(error);
    const requestId = req.requestId ?? randomUUID();
    if (normalized.status >= 500)
      logger.error('http.failure', {
        requestId,
        code: normalized.code,
        ...errorDiagnostics(error),
      });
    if (res.headersSent) {
      next(error);
      return;
    }
    if (res.destroyed) return;
    res.set('X-Request-Id', requestId);
    if (normalized.status === 503) res.set('Retry-After', '5');
    const payload: ApiErrorResponse = {
      error: {
        code: normalized.code,
        message: normalized.message,
        requestId,
        ...(normalized.issues ? { issues: normalized.issues } : {}),
      },
    };
    res.status(normalized.status).json(payload);
  };
}
