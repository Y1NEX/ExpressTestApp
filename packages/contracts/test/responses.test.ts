import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  listSnippetsSchema,
  snippetSchema,
  snippetListSchema,
  updateSnippetSchema,
} from '../src/index.js';

const snippet = {
  id: '12345678-1234-4234-8234-123456789abc',
  title: 'Example',
  content: '  code\n',
  category: 'SQL',
  favorite: false,
  createdAt: '2026-11-08T00:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
};
describe('shared response contracts', () => {
  it('accepts serialized DTOs but rejects database internals and non-JSON dates', () => {
    expect(snippetSchema.safeParse(snippet).success).toBe(true);
    expect(
      snippetSchema.safeParse({ ...snippet, ownerId: snippet.id }).success,
    ).toBe(false);
    expect(
      snippetSchema.safeParse({ ...snippet, createdAt: new Date() }).success,
    ).toBe(false);
  });
  it('rejects missing response fields and inconsistent pagination', () => {
    expect(snippetSchema.safeParse({ title: 'Missing fields' }).success).toBe(
      false,
    );
    expect(
      snippetListSchema.safeParse({
        data: [snippet],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }).success,
    ).toBe(false);
    expect(
      snippetListSchema.safeParse({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 21, totalPages: 1 },
      }).success,
    ).toBe(false);
  });
  it('requires a known error code and a valid correlation ID', () => {
    const error = {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
      requestId: snippet.id,
    };
    expect(apiErrorResponseSchema.safeParse({ error }).success).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse({ error: { ...error, code: 'UNKNOWN' } })
        .success,
    ).toBe(false);
    expect(
      apiErrorResponseSchema.safeParse({
        error: { ...error, stack: 'private' },
      }).success,
    ).toBe(false);
  });
  it.each(['0x10', '1e2', '+1', ' 1 ', '01', '', '1.0', ['1'], null, true])(
    'rejects ambiguous pagination input %j',
    (page) => {
      expect(listSnippetsSchema.safeParse({ page }).success).toBe(false);
    },
  );
  it.each(['\u00A0', '\uFEFF', '\u2007', '\n\r\t'])(
    'rejects Unicode/ASCII whitespace-only content',
    (content) => {
      expect(updateSnippetSchema.safeParse({ content }).success).toBe(false);
    },
  );
  it.each(['bad\u0000text', '\uD800', '\uDC00'])(
    'rejects text that cannot round-trip through PostgreSQL: %j',
    (content) => {
      expect(updateSnippetSchema.safeParse({ content }).success).toBe(false);
      expect(listSnippetsSchema.safeParse({ search: content }).success).toBe(
        false,
      );
    },
  );
});
