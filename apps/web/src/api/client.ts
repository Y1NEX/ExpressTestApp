import { tca } from '@itsezz/try-catch';
import { apiErrorResponseSchema, type ApiErrorCode } from '@snippet/contracts';
import type { z } from 'zod';

type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly requestId?: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'Das hat leider nicht funktioniert. Bitte versuche es erneut.';
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'E-Mail oder Passwort ist nicht richtig.';
    case 'UNAUTHENTICATED':
      return 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';
    case 'CSRF_INVALID':
      return 'Deine Sitzung hat sich geändert. Bitte versuche es erneut.';
    case 'RATE_LIMITED':
      return 'Zu viele Anmeldeversuche. Bitte versuche es später erneut.';
    case 'NETWORK_ERROR':
    case 'DATABASE_UNAVAILABLE':
    case 'SERVICE_UNAVAILABLE':
      return 'Der Server ist gerade nicht erreichbar. Bitte versuche es erneut.';
    default:
      return 'Das hat leider nicht funktioniert. Bitte versuche es erneut.';
  }
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    csrfToken?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(10000);
  const fetched = await tca(() =>
    fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(options.csrfToken ? { 'X-CSRF-Token': options.csrfToken } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
  if (!fetched.ok) throw new ApiError('NETWORK_ERROR');
  const response = fetched.data;
  const decoded = await tca(async () =>
    response.status === 204 ? undefined : ((await response.json()) as unknown),
  );
  if (!decoded.ok) throw new ApiError('INVALID_RESPONSE');
  if (!response.ok) {
    const failure = apiErrorResponseSchema.safeParse(decoded.data);
    if (!failure.success) throw new ApiError('INVALID_RESPONSE');
    throw new ApiError(failure.data.error.code, failure.data.error.requestId);
  }
  const parsed = schema.safeParse(decoded.data);
  if (!parsed.success) throw new ApiError('INVALID_RESPONSE');
  return parsed.data;
}
