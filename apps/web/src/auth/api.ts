import { tca } from '@itsezz/try-catch';
import {
  csrfResponseSchema,
  loginResponseSchema,
  loginSchema,
  userResponseSchema,
  type PublicUser,
} from '@snippet/contracts';
import { z } from 'zod';
import { apiRequest, ApiError } from '../api/client';

export type LoginValues = z.infer<typeof loginSchema>;

export async function currentUser(
  signal?: AbortSignal,
): Promise<PublicUser | null> {
  const result = await tca(() =>
    apiRequest('/auth/me', userResponseSchema, { signal }),
  );
  if (result.ok) return result.data.user;
  if (
    result.error instanceof ApiError &&
    result.error.code === 'UNAUTHENTICATED'
  )
    return null;
  throw result.error;
}

export async function login(values: LoginValues) {
  const credentials = loginSchema.parse(values);
  // Fetch a fresh token for each mutation; the browser alone owns the session cookie.
  const { csrfToken } = await apiRequest('/auth/csrf', csrfResponseSchema);
  return apiRequest('/auth/login', loginResponseSchema, {
    method: 'POST',
    body: credentials,
    csrfToken,
  });
}

export async function logout() {
  const result = await tca(async () => {
    const { csrfToken } = await apiRequest('/auth/csrf', csrfResponseSchema);
    await apiRequest('/auth/logout', z.undefined(), {
      method: 'POST',
      body: {},
      csrfToken,
    });
  });
  if (
    !result.ok &&
    !(
      result.error instanceof ApiError &&
      result.error.code === 'UNAUTHENTICATED'
    )
  )
    throw result.error;
}

export function validateLogin(values: LoginValues) {
  const result = loginSchema.safeParse(values);
  const errors: Partial<Record<keyof LoginValues, string>> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      if (issue.path[0] === 'email')
        errors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
      if (issue.path[0] === 'password')
        errors.password =
          values.password.length > 256
            ? 'Das Passwort darf höchstens 256 Zeichen enthalten.'
            : 'Bitte gib dein Passwort ein.';
    }
  }
  return errors;
}
