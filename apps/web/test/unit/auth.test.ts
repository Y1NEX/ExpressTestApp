import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiRequest, ApiError, errorMessage } from '../../src/api/client';
import { currentUser, login, logout, validateLogin } from '../../src/auth/api';

const user = {
  id: '381d16e7-1165-4130-bec1-6f98a21b20a2',
  email: 'owner@example.com',
};
const token = 'a'.repeat(64);
const error = (code: string, status: number) =>
  Response.json(
    { error: { code, message: 'Private provider detail', requestId: user.id } },
    { status },
  );
afterEach(() => vi.unstubAllGlobals());

describe('browser authentication boundary', () => {
  it('normalizes email and sends cookies plus a fresh CSRF token', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: token }))
      .mockResolvedValueOnce(
        Response.json({ user, csrfToken: 'b'.repeat(64) }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(
      login({ email: ' OWNER@EXAMPLE.COM ', password: ' secret ' }),
    ).resolves.toEqual({ user, csrfToken: 'b'.repeat(64) });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/login',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-CSRF-Token': token }),
        body: JSON.stringify({ email: user.email, password: ' secret ' }),
      }),
    );
  });
  it('treats an unauthenticated session as anonymous', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(error('UNAUTHENTICATED', 401)),
    );
    await expect(currentUser()).resolves.toBeNull();
  });
  it('keeps a database outage distinct from an anonymous session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(error('DATABASE_UNAVAILABLE', 503)),
    );
    await expect(currentUser()).rejects.toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
    });
  });
  it('validates the public user before returning it', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ user: { ...user, passwordHash: 'unexpected' } }),
        ),
    );
    await expect(currentUser()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('handles an expired session during logout as already logged out', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ csrfToken: token }))
        .mockResolvedValueOnce(error('UNAUTHENTICATED', 401)),
    );
    await expect(logout()).resolves.toBeUndefined();
  });
  it('propagates logout failures without pretending the session was destroyed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ csrfToken: token }))
        .mockResolvedValueOnce(error('SERVICE_UNAVAILABLE', 503)),
    );
    await expect(logout()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });
  it('accepts a successful bodyless logout response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ csrfToken: token }))
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );
    await expect(logout()).resolves.toBeUndefined();
  });
  it('converts network rejections into a safe client error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Internal network details')),
    );
    await expect(currentUser()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
  it('rejects invalid JSON rather than rendering a raw proxy response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>upstream error</html>', { status: 502 }),
        ),
    );
    await expect(currentUser()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('rejects malformed error envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'private detail' }, { status: 500 }),
        ),
    );
    await expect(currentUser()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('passes router cancellation to fetch', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    await apiRequest('/test', z.object({ ok: z.boolean() }), {
      signal: controller.signal,
    });
    controller.abort();
    expect(fetch.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });
  it('never uses a provider message as user-facing text', () => {
    expect(errorMessage(new ApiError('INVALID_CREDENTIALS', user.id))).toBe(
      'E-Mail oder Passwort ist nicht richtig.',
    );
    expect(errorMessage(new Error('Private provider detail'))).not.toContain(
      'Private provider detail',
    );
  });
  it('uses the shared login rules and preserves password whitespace', () => {
    expect(
      validateLogin({ email: ' OWNER@EXAMPLE.COM ', password: ' secret ' }),
    ).toEqual({});
    expect(validateLogin({ email: 'wrong', password: '' })).toEqual({
      email: expect.any(String),
      password: expect.any(String),
    });
    expect(
      validateLogin({ email: user.email, password: 'x'.repeat(257) }),
    ).toEqual({ password: expect.any(String) });
  });
});
