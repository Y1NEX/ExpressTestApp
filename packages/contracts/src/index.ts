import { z } from 'zod';

export const categories = [
  'GIT',
  'DOCKER',
  'SQL',
  'JAVASCRIPT',
  'TYPESCRIPT',
  'OTHER',
] as const;
export const categorySchema = z.enum(categories);

const postgresText = z
  .string()
  .refine(
    (value) => !value.includes('\0') && !/[\uD800-\uDFFF]/u.test(value),
    'Use valid Unicode text without null bytes',
  );
const title = postgresText.trim().min(1).max(120);
// Code keeps its original whitespace; only the emptiness check uses trim().
const content = postgresText
  .min(1)
  .max(50000)
  .refine((value) => value.trim().length > 0, {
    message: 'Content must not be blank',
  });

export const createSnippetSchema = z.strictObject({
  title,
  content,
  category: categorySchema.default('OTHER'),
  favorite: z.boolean().default(false),
});

// Deliberately no defaults here: omitted PATCH fields must remain unchanged.
export const updateSnippetSchema = z
  .strictObject({
    title: title.optional(),
    content: content.optional(),
    category: categorySchema.optional(),
    favorite: z.boolean().optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: 'Provide at least one field to update',
    },
  );

const queryBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const queryInteger = (maximum: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/, 'Use a positive decimal integer')
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
export const listSnippetsSchema = z.strictObject({
  search: postgresText.trim().max(200).optional(),
  category: categorySchema.optional(),
  favorite: queryBoolean.optional(),
  page: queryInteger(100000).default(1),
  pageSize: queryInteger(100).default(20),
  sortBy: z.enum(['updatedAt', 'createdAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const snippetIdSchema = z.uuid();
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(256),
});
export const ownerCredentialsSchema = z.strictObject({
  email: emailSchema,
  password: z
    .string()
    .min(12)
    .max(256)
    .refine(
      (value) => !value.startsWith('replace-'),
      'Replace the example OWNER_PASSWORD',
    ),
});

export type CreateSnippet = z.infer<typeof createSnippetSchema>;
export type UpdateSnippet = z.infer<typeof updateSnippetSchema>;
export type ListSnippets = z.infer<typeof listSnippetsSchema>;
export type Category = z.infer<typeof categorySchema>;
export const publicUserSchema = z.strictObject({
  id: z.uuid(),
  email: emailSchema,
});
export const snippetSchema = z.strictObject({
  id: z.uuid(),
  title,
  content,
  category: categorySchema,
  favorite: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const snippetResponseSchema = z.strictObject({ data: snippetSchema });
export const snippetListSchema = z
  .strictObject({
    data: z.array(snippetSchema),
    pagination: z.strictObject({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  })
  .superRefine(({ data, pagination }, context) => {
    if (
      data.length > pagination.pageSize ||
      data.length > pagination.total ||
      pagination.totalPages !==
        Math.ceil(pagination.total / pagination.pageSize)
    ) {
      context.addIssue({ code: 'custom', message: 'Inconsistent pagination' });
    }
  });
export const categoryListResponseSchema = z.strictObject({
  data: z.array(categorySchema),
});
export const csrfResponseSchema = z.strictObject({
  csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
});
export const loginResponseSchema = csrfResponseSchema.extend({
  user: publicUserSchema,
});
export const userResponseSchema = z.strictObject({ user: publicUserSchema });
export const healthResponseSchema = z.strictObject({ status: z.literal('ok') });
export const readinessResponseSchema = z.strictObject({
  status: z.enum(['ready', 'unavailable']),
});

export const errorCodes = [
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'BAD_REQUEST',
  'BODY_TOO_LARGE',
  'JSON_REQUIRED',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNSUPPORTED_ENCODING',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'CSRF_INVALID',
  'ORIGIN_FORBIDDEN',
  'NOT_FOUND',
  'SNIPPET_NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DATABASE_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export const validationIssueSchema = z.strictObject({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});
export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(errorCodes),
    message: z.string(),
    requestId: z.uuid(),
    issues: z.array(validationIssueSchema).optional(),
  }),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type Snippet = z.infer<typeof snippetSchema>;
export type SnippetList = z.infer<typeof snippetListSchema>;
export type ApiErrorCode = (typeof errorCodes)[number];
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
