import {
  csrfResponseSchema,
  labelListResponseSchema,
  snippetListSchema,
  snippetResponseSchema,
  type CreateSnippet,
  type UpdateSnippet,
} from '@snippet/contracts';
import { z } from 'zod';
import { apiRequest } from '../api/client';

export const loadSnippets = (query: string, signal: AbortSignal) =>
  apiRequest('/snippets?' + query, snippetListSchema, { signal });
export const loadLabels = (signal: AbortSignal) =>
  apiRequest('/snippets/labels', labelListResponseSchema, { signal });
async function token() {
  return (await apiRequest('/auth/csrf', csrfResponseSchema)).csrfToken;
}
export async function saveSnippet(
  values: CreateSnippet | UpdateSnippet,
  id?: string,
) {
  return apiRequest(
    id ? '/snippets/' + id : '/snippets',
    snippetResponseSchema,
    {
      method: id ? 'PATCH' : 'POST',
      body: values,
      csrfToken: await token(),
    },
  );
}
export async function deleteSnippet(id: string) {
  await apiRequest('/snippets/' + id, z.undefined(), {
    method: 'DELETE',
    csrfToken: await token(),
  });
}
