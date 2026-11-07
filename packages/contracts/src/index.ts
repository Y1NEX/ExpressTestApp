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

const title = z.string().trim().min(1).max(120);
// Code keeps its original whitespace; only the emptiness check uses trim().
const content = z
  .string()
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
export const listSnippetsSchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  category: categorySchema.optional(),
  favorite: queryBoolean.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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
export type PublicUser = { id: string; email: string };
export type Snippet = {
  id: string;
  title: string;
  content: string;
  category: Category;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};
export type SnippetList = {
  data: Snippet[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
