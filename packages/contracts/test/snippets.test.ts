import { describe, expect, it } from 'vitest';
import {
  createSnippetSchema,
  emailSchema,
  listSnippetsSchema,
  updateSnippetSchema,
} from '../src/index.js';

describe('snippet contracts', () => {
  it('applies create defaults and preserves code whitespace', () => {
    expect(
      createSnippetSchema.parse({ title: '  SQL  ', content: '  SELECT 1;\n' }),
    ).toEqual({
      title: 'SQL',
      content: '  SELECT 1;\n',
      category: 'OTHER',
      favorite: false,
    });
  });
  it.each([{}, { title: undefined }])('rejects an empty PATCH: %j', (input) => {
    expect(updateSnippetSchema.safeParse(input).success).toBe(false);
  });
  it.each([
    { title: 'Changed' },
    { content: 'Changed' },
    { category: 'GIT' },
    { favorite: false },
  ])('accepts a single PATCH field without injecting defaults: %j', (input) => {
    expect(updateSnippetSchema.parse(input)).toEqual(input);
  });
  it.each([
    { title: '' },
    { title: '  ' },
    { title: null },
    { content: '\n\t ' },
    { content: null },
    { favorite: 'false' },
    { category: 'UNKNOWN' },
    { ownerId: 'injected' },
  ])('rejects invalid PATCH %j', (input) => {
    expect(updateSnippetSchema.safeParse(input).success).toBe(false);
  });
  it('accepts the exact title and content limits, rejects beyond them', () => {
    expect(
      createSnippetSchema.safeParse({
        title: 'x'.repeat(120),
        content: 'x'.repeat(50000),
      }).success,
    ).toBe(true);
    expect(
      createSnippetSchema.safeParse({ title: 'x'.repeat(121), content: 'x' })
        .success,
    ).toBe(false);
    expect(
      createSnippetSchema.safeParse({ title: 'x', content: 'x'.repeat(50001) })
        .success,
    ).toBe(false);
  });
  it('parses false as false and supplies pagination defaults', () => {
    expect(listSnippetsSchema.parse({ favorite: 'false' })).toEqual({
      favorite: false,
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
  });
  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.2' },
    { pageSize: '101' },
    { favorite: 'yes' },
    { sortBy: 'passwordHash' },
    { unknown: 'x' },
  ])('rejects invalid list input %j', (input) => {
    expect(listSnippetsSchema.safeParse(input).success).toBe(false);
  });
  it('normalizes email before validating', () =>
    expect(emailSchema.parse(' OWNER@Example.COM ')).toBe('owner@example.com'));
});
