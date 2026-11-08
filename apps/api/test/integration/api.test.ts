import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '@snippet/database';
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/auth/passwords.js';
import { readConfig } from '../../src/config.js';
import {
  apiErrorResponseSchema,
  snippetResponseSchema,
  snippetListSchema,
} from '@snippet/contracts';

const config = readConfig();
if (
  !/^\/snippet_test_[a-f0-9]{32}$/.test(new URL(config.DATABASE_URL).pathname)
) {
  throw new Error(
    'Integration tests only run in a database created by the isolated test runner.',
  );
}
const db = createDatabase(config.DATABASE_URL);
const password = 'test-password-123456';
let application: Awaited<ReturnType<typeof createApp>>;
let server: Server;
let ownerId: string;
let otherId: string;
let token: string;
let agent: ReturnType<typeof request.agent>;

function responseCookies(response: {
  headers: Record<string, unknown>;
}): string[] {
  const value = response.headers['set-cookie'];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
    return value;
  if (typeof value === 'string') return [value];
  throw new Error('Expected a session cookie in the response');
}

async function login(
  client: ReturnType<typeof request.agent>,
  email = 'owner@example.com',
) {
  const csrf = await client.get('/api/auth/csrf').expect(200);
  const result = await client
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email, password })
    .expect(200);
  return result.body.csrfToken as string;
}

async function makeSnippet(input: Record<string, unknown> = {}) {
  return agent
    .post('/api/snippets')
    .set('X-CSRF-Token', token)
    .send({ title: 'Example', content: '  SELECT 1;\n', ...input })
    .expect(201);
}

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  ownerId = (
    await db.user.create({ data: { email: 'owner@example.com', passwordHash } })
  ).id;
  otherId = (
    await db.user.create({ data: { email: 'other@example.com', passwordHash } })
  ).id;
  application = await createApp(db, config);
  // Bind a real TCP port: requests exercise the running HTTP server and PostgreSQL.
  server = await new Promise<Server>((resolve) => {
    const instance = application.app.listen(0, '127.0.0.1', () =>
      resolve(instance),
    );
  });
  agent = request.agent(server);
  token = await login(agent);
});

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  if (application) await application.close();
  await db.user.deleteMany({
    where: { id: { in: [ownerId, otherId].filter(Boolean) } },
  });
  await db.$disconnect();
});

describe('health and authentication', () => {
  it('checks liveness and database readiness', async () => {
    await request(server).get('/health').expect(200, { status: 'ok' });
    await request(server).get('/ready').expect(200, { status: 'ready' });
  });
  it('reports unavailable readiness when PostgreSQL cannot be reached', async () => {
    const unavailableUrl = new URL(config.DATABASE_URL);
    unavailableUrl.port = '1';
    const unavailableDb = createDatabase(unavailableUrl.toString());
    const offline = await createApp(unavailableDb, {
      ...config,
      DATABASE_URL: unavailableUrl.toString(),
    });
    try {
      await request(offline.app)
        .get('/ready')
        .expect(503, { status: 'unavailable' });
      await request(offline.app).get('/health').expect(200, { status: 'ok' });
    } finally {
      await offline.close();
      await unavailableDb.$disconnect();
    }
  });
  it('rejects anonymous list/detail/category access', async () => {
    for (const path of [
      '/api/snippets',
      `/api/snippets/${randomUUID()}`,
      '/api/snippets/categories',
      '/api/auth/me',
    ]) {
      await request(server).get(path).expect(401);
    }
  });
  it('exposes only the public user and disables caching', async () => {
    const result = await agent.get('/api/auth/me').expect(200);
    expect(result.body).toEqual({
      user: { id: ownerId, email: 'owner@example.com' },
    });
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('normalizes email on login and issues an HttpOnly SameSite cookie', async () => {
    const client = request.agent(server);
    const csrf = await client.get('/api/auth/csrf').expect(200);
    const result = await client
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: ' OWNER@EXAMPLE.COM ', password })
      .expect(200);
    const cookies = responseCookies(result);
    expect(cookies.join(';')).toContain('HttpOnly');
    expect(cookies.join(';')).toContain('SameSite=Lax');
    expect(result.body.csrfToken).not.toBe(csrf.body.csrfToken);
  });
  it('uses the same response for unknown email and incorrect password', async () => {
    const client = request.agent(server);
    const csrf = await client.get('/api/auth/csrf').expect(200);
    const wrong = await client
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'owner@example.com', password: 'wrong' })
      .expect(401);
    const unknown = await client
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'absent@example.com', password: 'wrong' })
      .expect(401);
    expect(wrong.body.error.code).toBe(unknown.body.error.code);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(wrong.body.error.requestId).not.toBe(unknown.body.error.requestId);
  });
  it('rejects missing CSRF token and foreign origin', async () => {
    await agent
      .post('/api/snippets')
      .send({ title: 'X', content: 'Y' })
      .expect(403);
    await agent
      .post('/api/snippets')
      .set('X-CSRF-Token', token)
      .set('Origin', 'https://foreign.example')
      .send({ title: 'X', content: 'Y' })
      .expect(403);
  });
  it('rejects invalid tokens without a server error', async () => {
    await agent
      .post('/api/snippets')
      .set('X-CSRF-Token', 'g'.repeat(64))
      .send({ title: 'X', content: 'Y' })
      .expect(403);
    await agent
      .post('/api/snippets')
      .set('X-CSRF-Token', 'wrong')
      .send({ title: 'X', content: 'Y' })
      .expect(403);
  });
  it('rejects writes from a session that has a CSRF token but is not logged in', async () => {
    const client = request.agent(server);
    const csrf = await client.get('/api/auth/csrf').expect(200);
    await client
      .post('/api/snippets')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ title: 'X', content: 'Y' })
      .expect(401);
  });
  it('persists sessions across an application restart', async () => {
    const restarted = await createApp(db, config);
    try {
      // Use the authenticated session cookie with a second application instance.
      const loginCsrf = await request(server).get('/api/auth/csrf');
      const response = await request(server)
        .post('/api/auth/login')
        .set('Cookie', responseCookies(loginCsrf))
        .set('X-CSRF-Token', loginCsrf.body.csrfToken)
        .send({ email: 'owner@example.com', password })
        .expect(200);
      await request(restarted.app)
        .get('/api/auth/me')
        .set('Cookie', responseCookies(response))
        .expect(200);
      await request(server)
        .get('/api/auth/me')
        .set('Cookie', responseCookies(loginCsrf))
        .expect(401);
    } finally {
      await restarted.close();
    }
  });
  it('rejects expired sessions', async () => {
    const csrf = await request(server).get('/api/auth/csrf').expect(200);
    const response = await request(server)
      .post('/api/auth/login')
      .set('Cookie', responseCookies(csrf))
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'owner@example.com', password })
      .expect(200);
    const sessionCookie = responseCookies(response)[0]!;
    const signedValue = decodeURIComponent(
      sessionCookie.split(';')[0]!.slice('snippet.sid='.length),
    );
    const sid = signedValue.slice(2, signedValue.lastIndexOf('.'));
    await db.session.update({
      where: { sid },
      data: { expire: new Date(Date.now() - 60000) },
    });
    await request(server)
      .get('/api/auth/me')
      .set('Cookie', responseCookies(response))
      .expect(401);
  });
  it('destroys a session on logout, including replay of the old cookie', async () => {
    const csrf = await request(server).get('/api/auth/csrf').expect(200);
    const response = await request(server)
      .post('/api/auth/login')
      .set('Cookie', responseCookies(csrf))
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'owner@example.com', password })
      .expect(200);
    const cookie = responseCookies(response);
    await request(server)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', response.body.csrfToken)
      .send({})
      .expect(204);
    await request(server).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });
});

describe('snippet CRUD and PATCH edge cases', () => {
  it('creates defaults, trims the title, and preserves the exact content', async () => {
    const result = await makeSnippet({ title: '  SQL example  ' });
    expect(result.body.data).toMatchObject({
      title: 'SQL example',
      content: '  SELECT 1;\n',
      category: 'OTHER',
      favorite: false,
    });
    expect(result.body.data.ownerId).toBeUndefined();
    expect(snippetResponseSchema.safeParse(result.body).success).toBe(true);
    expect(result.headers.location).toBe(
      `/api/snippets/${result.body.data.id}`,
    );
    await agent.get(result.headers.location!).expect(200, result.body);
  });
  it('accepts duplicate titles and stores code as text', async () => {
    const code = '<script>alert("test")</script>\n💻 ü';
    await makeSnippet({ title: 'Duplicate', content: code });
    const second = await makeSnippet({ title: 'Duplicate', content: code });
    expect(second.body.data.content).toBe(code);
    expect(second.headers['content-type']).toContain('application/json');
  });
  it('updates one field while preserving all omitted fields', async () => {
    const created = await makeSnippet({ category: 'DOCKER', favorite: true });
    const id = created.body.data.id;
    const updated = await agent
      .patch(`/api/snippets/${id}`)
      .set('X-CSRF-Token', token)
      .send({ title: 'New title' })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      title: 'New title',
      content: created.body.data.content,
      category: 'DOCKER',
      favorite: true,
      createdAt: created.body.data.createdAt,
    });
    expect(Date.parse(updated.body.data.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(created.body.data.updatedAt),
    );
  });
  it('updates favorite to false without dropping the value', async () => {
    const created = await makeSnippet({ favorite: true });
    const updated = await agent
      .patch(`/api/snippets/${created.body.data.id}`)
      .set('X-CSRF-Token', token)
      .send({ favorite: false })
      .expect(200);
    expect(updated.body.data.favorite).toBe(false);
    expect(updated.body.data.category).toBe('OTHER');
  });
  it.each([
    {},
    { title: '' },
    { title: '   ' },
    { content: ' \n\t' },
    { title: null },
    { content: null },
    { category: null },
    { favorite: null },
    { favorite: 'false' },
    { category: 'PYTHON' },
    { ownerId: randomUUID() },
    { id: randomUUID() },
  ])('rejects invalid PATCH without changing the row: %j', async (input) => {
    const created = await makeSnippet();
    await agent
      .patch(`/api/snippets/${created.body.data.id}`)
      .set('X-CSRF-Token', token)
      .send(input)
      .expect(400);
    await agent
      .get(`/api/snippets/${created.body.data.id}`)
      .expect(200, created.body);
  });
  it('rejects a PATCH with no request body', async () => {
    const created = await makeSnippet();
    await agent
      .patch(`/api/snippets/${created.body.data.id}`)
      .set('Content-Type', 'application/json')
      .set('X-CSRF-Token', token)
      .expect(400);
  });
  it.each([
    {},
    { title: 'Only title' },
    { content: 'Only content' },
    { title: 'A', content: 'B', favorite: 'true' },
    { title: 'A', content: 'B', unknown: true },
  ])('rejects invalid create input %j', async (input) => {
    await agent
      .post('/api/snippets')
      .set('X-CSRF-Token', token)
      .send(input)
      .expect(400);
  });
  it('enforces exact field length boundaries over HTTP', async () => {
    const created = await makeSnippet({
      title: 'x'.repeat(120),
      content: 'x'.repeat(50000),
    });
    await agent
      .patch(`/api/snippets/${created.body.data.id}`)
      .set('X-CSRF-Token', token)
      .send({ content: 'x'.repeat(50001) })
      .expect(400);
    await agent
      .patch(`/api/snippets/${created.body.data.id}`)
      .set('X-CSRF-Token', token)
      .send({ title: 'x'.repeat(121) })
      .expect(400);
  });
  it('returns 400 for invalid UUIDs and 404 for valid unknown IDs', async () => {
    for (const method of ['get', 'patch', 'delete'] as const) {
      const invalid = agent[method]('/api/snippets/not-a-uuid').set(
        'X-CSRF-Token',
        token,
      );
      const absent = agent[method](`/api/snippets/${randomUUID()}`).set(
        'X-CSRF-Token',
        token,
      );
      if (method === 'patch') {
        invalid.send({ title: 'X' });
        absent.send({ title: 'X' });
      }
      await invalid.expect(400);
      await absent.expect(404);
    }
  });
  it('deletes a row and reports 404 for repeated deletion', async () => {
    const created = await makeSnippet();
    const path = `/api/snippets/${created.body.data.id}`;
    await agent.delete(path).set('X-CSRF-Token', token).expect(204);
    await agent.get(path).expect(404);
    await agent.delete(path).set('X-CSRF-Token', token).expect(404);
  });
});

describe('ownership, list filters, and request errors', () => {
  it('isolates list, read, update, and delete by owner', async () => {
    const other = await db.snippet.create({
      data: {
        ownerId: otherId,
        title: 'private-other-user',
        content: 'secret',
      },
    });
    expect(
      (await agent.get('/api/snippets?search=private-other-user').expect(200))
        .body.pagination.total,
    ).toBe(0);
    await agent.get(`/api/snippets/${other.id}`).expect(404);
    await agent
      .patch(`/api/snippets/${other.id}`)
      .set('X-CSRF-Token', token)
      .send({ title: 'hacked' })
      .expect(404);
    await agent
      .delete(`/api/snippets/${other.id}`)
      .set('X-CSRF-Token', token)
      .expect(404);
    expect(
      (await db.snippet.findUniqueOrThrow({ where: { id: other.id } })).title,
    ).toBe('private-other-user');
  });
  it('combines case-insensitive search, category, false filter and pagination', async () => {
    const prefix = randomUUID();
    await makeSnippet({
      title: `${prefix} Alpha`,
      content: 'NeEdLe',
      category: 'GIT',
      favorite: false,
    });
    await makeSnippet({
      title: `${prefix} Beta needle`,
      category: 'GIT',
      favorite: false,
    });
    await makeSnippet({
      title: `${prefix} Gamma needle`,
      category: 'GIT',
      favorite: true,
    });
    const query = `search=${prefix}&category=GIT&favorite=false&pageSize=1&sortBy=title&sortOrder=asc`;
    const first = await agent.get(`/api/snippets?${query}&page=1`).expect(200);
    const second = await agent.get(`/api/snippets?${query}&page=2`).expect(200);
    expect(first.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(first.body.data[0].title).toBe(`${prefix} Alpha`);
    expect(second.body.data[0].title).toBe(`${prefix} Beta needle`);
    const contentSearch = await agent
      .get('/api/snippets?search=NEEDLE&category=GIT&favorite=false')
      .expect(200);
    expect(
      contentSearch.body.data.some(
        (row: { title: string }) => row.title === `${prefix} Alpha`,
      ),
    ).toBe(true);
  });
  it('uses stable ID ordering when primary sort values tie', async () => {
    const title = `tie-${randomUUID()}`;
    await makeSnippet({ title });
    await makeSnippet({ title });
    const first = await agent
      .get(`/api/snippets?search=${title}&sortBy=title&pageSize=1&page=1`)
      .expect(200);
    const second = await agent
      .get(`/api/snippets?search=${title}&sortBy=title&pageSize=1&page=2`)
      .expect(200);
    expect(first.body.data[0].id < second.body.data[0].id).toBe(true);
  });
  it('treats SQL wildcard characters and SQL-like strings as literal search input', async () => {
    const title = `literal-${randomUUID()}-100%_done\\path`;
    await makeSnippet({ title });
    const result = await agent
      .get('/api/snippets')
      .query({ search: title })
      .expect(200);
    expect(result.body.pagination.total).toBe(1);
    expect(result.body.data[0].title).toBe(title);
    const injection = await agent
      .get('/api/snippets')
      .query({ search: "' OR 1=1 --" })
      .expect(200);
    expect(injection.body.pagination.total).toBe(0);
  });
  it('returns empty pages and zero totalPages for no matches', async () => {
    const result = await agent
      .get(`/api/snippets?search=${randomUUID()}&page=2`)
      .expect(200);
    expect(result.body).toEqual({
      data: [],
      pagination: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
    });
    expect(snippetListSchema.safeParse(result.body).success).toBe(true);
  });
  it.each([
    'page=0',
    'page=-1',
    'page=NaN',
    'page=1.2',
    'pageSize=101',
    'favorite=yes',
    'sortBy=passwordHash',
    'category=UNKNOWN',
    'extra=1',
    'page=1&page=2',
  ])('rejects invalid list query %s', async (query) => {
    await agent.get(`/api/snippets?${query}`).expect(400);
  });
  it('keeps database enum and public categories aligned', async () => {
    const result = await agent.get('/api/snippets/categories').expect(200);
    const rows = await db.$queryRaw<
      { value: string }[]
    >`SELECT unnest(enum_range(NULL::"Category"))::text AS value`;
    expect(result.body.data).toEqual(rows.map((row) => row.value));
  });
  it('returns structured JSON errors for invalid JSON, wrong media type, oversize and unknown routes', async () => {
    const malformed = await agent
      .post('/api/snippets')
      .set('Content-Type', 'application/json')
      .set('X-CSRF-Token', token)
      .send('{')
      .expect(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    expect(apiErrorResponseSchema.safeParse(malformed.body).success).toBe(true);
    await agent
      .post('/api/snippets')
      .set('X-CSRF-Token', token)
      .type('form')
      .send({ title: 'X', content: 'Y' })
      .expect(415);
    await agent
      .post('/api/snippets')
      .set('X-CSRF-Token', token)
      .send({ title: 'X', content: 'x'.repeat(600000) })
      .expect(413);
    const unknown = await agent.get('/api/unknown').expect(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });
  it('uses database constraints even when code bypasses Zod', async () => {
    await expect(
      db.snippet.create({ data: { ownerId, title: ' ', content: 'x' } }),
    ).rejects.toThrow();
    await expect(
      db.snippet.create({
        data: { ownerId: randomUUID(), title: 'X', content: 'x' },
      }),
    ).rejects.toThrow();
    await expect(
      db.user.create({
        data: { email: 'owner@example.com', passwordHash: 'unused' },
      }),
    ).rejects.toThrow();
  });
});

describe('login rate limiting', () => {
  it('limits repeated failed logins with a JSON response', async () => {
    // Separate app instance gives this test its own in-memory rate limiter.
    const isolated = await createApp(db, config);
    try {
      const client = request.agent(isolated.app);
      const csrf = await client.get('/api/auth/csrf').expect(200);
      for (let i = 0; i < 10; i++) {
        await client
          .post('/api/auth/login')
          .set('X-CSRF-Token', csrf.body.csrfToken)
          .send({ email: 'owner@example.com', password: 'wrong' })
          .expect(401);
      }
      const result = await client
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email: 'owner@example.com', password: 'wrong' })
        .expect(429);
      expect(result.body.error.code).toBe('RATE_LIMITED');
    } finally {
      await isolated.close();
    }
  });
});
