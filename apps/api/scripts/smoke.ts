import assert from 'node:assert/strict';
import { ownerCredentialsSchema } from '@snippet/contracts';
import '../src/config.js';

const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const credentials = ownerCredentialsSchema.parse({
  email: process.env.OWNER_EMAIL,
  password: process.env.OWNER_PASSWORD,
});
let cookie = '';
let csrf = '';
let id: string | undefined;
let checks = 0;

async function call(
  path: string,
  status: number,
  method = 'GET',
  body?: unknown,
) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, status, `${method} ${path}`);
  const cookies = response.headers.getSetCookie();
  if (cookies.length)
    cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  checks++;
  return status === 204 ? undefined : await response.json();
}

try {
  await call('/health', 200);
  await call('/ready', 200);
  await call('/api/snippets', 401);
  csrf = (await call('/api/auth/csrf', 200)).csrfToken;
  csrf = (await call('/api/auth/login', 200, 'POST', credentials)).csrfToken;
  await call('/api/auth/me', 200);
  const created = (
    await call('/api/snippets', 201, 'POST', {
      title: 'Smoke test',
      content: '  SELECT 1;\n',
      category: 'SQL',
      favorite: true,
    })
  ).data;
  id = created.id;
  const updated = (
    await call(`/api/snippets/${id}`, 200, 'PATCH', { title: 'Smoke updated' })
  ).data;
  assert.equal(updated.content, created.content);
  assert.equal(updated.category, 'SQL');
  assert.equal(updated.favorite, true);
  const unfavorited = (
    await call(`/api/snippets/${id}`, 200, 'PATCH', { favorite: false })
  ).data;
  assert.equal(unfavorited.favorite, false);
  await call(`/api/snippets/${id}`, 400, 'PATCH', {});
  await call(`/api/snippets/${id}`, 400, 'PATCH', { content: '' });
  await call('/api/snippets?favorite=false&pageSize=1', 200);
  await call(`/api/snippets/${id}`, 204, 'DELETE');
  const deletedId = id;
  id = undefined;
  await call(`/api/snippets/${deletedId}`, 404);
  await call('/api/auth/logout', 204, 'POST', {});
  await call('/api/auth/me', 401);
  console.log(
    `Live smoke test passed: ${checks} HTTP checks; temporary snippet removed.`,
  );
} finally {
  if (id) await call(`/api/snippets/${id}`, 204, 'DELETE');
}
