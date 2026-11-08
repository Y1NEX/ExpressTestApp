import express from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID, scryptSync } from 'node:crypto';
import { createDatabase } from '@snippet/database';
import { apiErrorResponseSchema } from '@snippet/contracts';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { createLogger } from '../../src/core/logger.js';
import { requestContext } from '../../src/http/context.js';
import { asyncHandler } from '../../src/http/async-handler.js';
import { errorHandler } from '../../src/http/error-handler.js';
import { startRuntime } from '../../src/runtime.js';

const config = readConfig();
if (
  !/^\/snippet_test_[a-f0-9]{32}$/.test(new URL(config.DATABASE_URL).pathname)
)
  throw new Error('Isolated test database required');
const db = createDatabase(config.DATABASE_URL);
const logger = createLogger('silent');
afterAll(async () => {
  await db.$disconnect();
});

describe('real database and transport failure paths', () => {
  it('returns a safe 503 for a real database failure through the global handler', async ({
    onTestFinished,
  }) => {
    const url = new URL(config.DATABASE_URL);
    url.port = '1';
    const offline = createDatabase(url.toString());
    onTestFinished(async () => {
      await offline.$disconnect();
    });

    const app = express();
    app.use(requestContext(logger));
    app.get(
      '/',
      asyncHandler(async () => {
        await offline.$queryRaw`SELECT 1`;
      }),
    );
    app.use(errorHandler(logger));
    const response = await request(app).get('/').expect(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
  it('rejects malformed compressed bodies as a client error', async ({
    onTestFinished,
  }) => {
    const app = await createApp(db, config);
    onTestFinished(async () => {
      await app.close();
    });

    const response = await request(app.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('not a gzip stream')
      .expect(400);
    expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
  it('validates JSON primitives, arrays and null through the request schema', async ({
    onTestFinished,
  }) => {
    const app = await createApp(db, config);
    onTestFinished(async () => {
      await app.close();
    });

    const client = request.agent(app.app);
    const csrf = await client.get('/api/auth/csrf');
    for (const body of ['null', 'false', '[]', '0', '"text"']) {
      const response = await client
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
  it('translates real unique and check constraint failures through the global handler', async ({
    onTestFinished,
  }) => {
    const email = `${randomUUID()}@example.com`;
    const user = await db.user.create({
      data: { email, passwordHash: 'test-only' },
    });
    onTestFinished(async () => {
      await db.user.delete({ where: { id: user.id } });
    });

    const app = express();
    app.use(requestContext(logger));
    app.post(
      '/duplicate',
      asyncHandler(async () => {
        await db.user.create({ data: { email, passwordHash: 'test-only' } });
      }),
    );
    app.post(
      '/constraint',
      asyncHandler(async () => {
        await db.snippet.create({
          data: { ownerId: user.id, title: 'X', content: '\u00A0\n\t' },
        });
      }),
    );
    app.use(errorHandler(logger));
    const duplicate = await request(app).post('/duplicate').expect(409);
    const constraint = await request(app).post('/constraint').expect(400);
    expect(apiErrorResponseSchema.safeParse(duplicate.body).success).toBe(true);
    expect(apiErrorResponseSchema.safeParse(constraint.body).success).toBe(
      true,
    );
  });
  it('rejects unsupported charset and encoding as client errors', async ({
    onTestFinished,
  }) => {
    const app = await createApp(db, config);
    onTestFinished(async () => {
      await app.close();
    });

    const encoding = await request(app.app)
      .post('/api/auth/login')
      .set('Content-Encoding', 'unsupported')
      .send({})
      .expect(415);
    const charset = await request(app.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=made-up')
      .send('{}')
      .expect(415);
    expect(apiErrorResponseSchema.safeParse(encoding.body).success).toBe(true);
    expect(apiErrorResponseSchema.safeParse(charset.body).success).toBe(true);
  });
  it('upgrades a legacy password hash only after a successful login', async ({
    onTestFinished,
  }) => {
    const salt = 'b'.repeat(32);
    const password = 'legacy-password-12345';
    const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
    const user = await db.user.create({
      data: { email: `${randomUUID()}@example.com`, passwordHash },
    });
    onTestFinished(async () => {
      await db.user.delete({ where: { id: user.id } });
    });
    const app = await createApp(db, config);
    onTestFinished(async () => {
      await app.close();
    });

    const client = request.agent(app.app);
    const csrf = await client.get('/api/auth/csrf');
    await client
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: user.email, password: 'wrong' })
      .expect(401);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash,
    ).toBe(passwordHash);
    await client
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: user.email, password })
      .expect(200);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash,
    ).toMatch(/^scrypt\$32768\$8\$3\$/);
  });
  it('marks a draining instance unready while keeping liveness available', async ({
    onTestFinished,
  }) => {
    const app = await createApp(db, config);
    onTestFinished(async () => {
      await app.close();
    });

    await request(app.app).get('/ready').expect(200);
    app.drain();
    await request(app.app).get('/ready').expect(503);
    await request(app.app).get('/health').expect(200);
  });
  it('starts the actual runtime, cleans up a failed bind, and shuts down idempotently', async ({
    onTestFinished,
  }) => {
    const runtime = await startRuntime({ ...config, PORT: 0 });
    onTestFinished(async () => {
      await runtime.shutdown();
    });

    const address = runtime.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected TCP listener');
    await request(runtime.server).get('/ready').expect(200);
    await expect(
      startRuntime({ ...config, PORT: address.port }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    await request(runtime.server).get('/health').expect(200);
    expect(runtime.server.headersTimeout).toBe(10000);
    const first = runtime.shutdown();
    const second = runtime.shutdown();
    expect(first).toBe(second);
    await first;
    expect(runtime.server.listening).toBe(false);
  });
});
