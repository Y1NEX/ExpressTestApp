import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Prisma } from '@snippet/database';
import { apiErrorResponseSchema } from '@snippet/contracts';
import { asyncHandler } from '../../src/http/async-handler.js';
import { errorHandler, normalizeError } from '../../src/http/error-handler.js';
import { requestContext } from '../../src/http/context.js';
import { createLogger } from '../../src/core/logger.js';
import { respond } from '../../src/http/respond.js';

describe('global error boundary', () => {
  it.each([
    ['P2000', 400],
    ['P2002', 409],
    ['P2003', 409],
    ['P2004', 400],
    ['P2011', 400],
    ['P2014', 409],
    ['P2025', 404],
    ['P2024', 503],
    ['P2034', 409],
    ['P2037', 503],
    ['P9999', 500],
  ])(
    'maps Prisma %s without exposing database details',
    async (code, status) => {
      const logger = createLogger('silent');
      const app = express();
      app.use(requestContext(logger));
      app.get(
        '/',
        asyncHandler(async () => {
          throw new Prisma.PrismaClientKnownRequestError(
            'private table and secret-password',
            {
              code,
              clientVersion: '7.10.1',
              meta: { target: ['private_column'] },
            },
          );
        }),
      );
      app.use(errorHandler(logger));
      const response = await request(app).get('/').expect(status);
      expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(
        true,
      );
      expect(JSON.stringify(response.body)).not.toMatch(
        /private|secret-password|Prisma/,
      );
      expect(response.body.error.requestId).toBe(
        response.headers['x-request-id'],
      );
      if (status === 503) expect(response.headers['retry-after']).toBe('5');
    },
  );
  it.each([null, undefined, 'route', 'router', 123, { arbitrary: true }])(
    'handles non-Error rejections without skipping routes or hanging',
    async (thrown) => {
      const app = express();
      const logger = createLogger('silent');
      app.use(requestContext(logger));
      app.get(
        '/',
        asyncHandler(async () => {
          throw thrown;
        }),
      );
      app.use(errorHandler(logger));
      const result = await request(app).get('/').timeout(2000).expect(500);
      expect(result.body.error.code).toBe('INTERNAL_ERROR');
    },
  );
  it('distinguishes invalid client input from a broken server response', async () => {
    const app = express();
    const logger = createLogger('silent');
    app.use(requestContext(logger));
    app.get('/input', () => {
      z.number().parse('wrong');
    });
    app.get('/output', (_req, res) => {
      respond(res, z.number(), 'wrong' as unknown as number);
    });
    app.use(errorHandler(logger));
    expect((await request(app).get('/input').expect(400)).body.error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect(
      (await request(app).get('/output').expect(500)).body.error.code,
    ).toBe('INTERNAL_ERROR');
  });
  it('logs correlation metadata without request bodies, query strings, cookies, or error messages', async () => {
    const lines: string[] = [];
    const logger = createLogger('info', (line) => {
      lines.push(line);
    });
    const app = express();
    app.use(requestContext(logger));
    app.post('/failure', () => {
      throw new Error('private-error-secret');
    });
    app.use(errorHandler(logger));
    const result = await request(app)
      .post('/failure?password=private-query')
      .set('Cookie', 'secret=private-cookie')
      .set('X-Request-Id', 'forged')
      .send({ password: 'private-body' })
      .expect(500);
    expect(result.headers['x-request-id']).not.toBe('forged');
    expect(lines.join('')).not.toMatch(/private-|forged/);
    expect(
      lines.some((line) => JSON.parse(line).event === 'http.failure'),
    ).toBe(true);
    expect(
      lines.some((line) => JSON.parse(line).event === 'http.request'),
    ).toBe(true);
    expect(
      lines.every(
        (line) => JSON.parse(line).requestId === result.headers['x-request-id'],
      ),
    ).toBe(true);
  });
  it('classifies PostgreSQL connectivity failures but leaves programmer errors internal', () => {
    expect(
      normalizeError(
        Object.assign(new Error('secret'), { code: 'ECONNREFUSED' }),
      ).status,
    ).toBe(503);
    expect(
      normalizeError(
        new Prisma.PrismaClientValidationError('secret', {
          clientVersion: '7.10.1',
        }),
      ).status,
    ).toBe(500);
  });
  it.each([
    ['entity.parse.failed', 400],
    ['entity.too.large', 413],
    ['encoding.unsupported', 415],
    ['charset.unsupported', 415],
    ['request.aborted', 400],
    ['request.size.invalid', 400],
  ])('classifies parser failure %s', (type, status) => {
    expect(
      normalizeError(Object.assign(new Error('sensitive raw body'), { type }))
        .status,
    ).toBe(status);
  });
});
