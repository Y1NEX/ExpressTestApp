import type {
  CreateSnippet,
  ListSnippets,
  UpdateSnippet,
} from '@snippet/contracts';
import type { Prisma, PrismaClient } from '@snippet/database';
import { HttpError } from '../http/errors.js';

const publicFields = {
  id: true,
  title: true,
  content: true,
  category: true,
  favorite: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function snippetService(db: PrismaClient) {
  return {
    create(ownerId: string, input: CreateSnippet) {
      return db.snippet.create({
        data: { ...input, ownerId },
        select: publicFields,
      });
    },

    async list(ownerId: string, input: ListSnippets) {
      // PostgreSQL LIKE treats %, _ and backslash specially. Search is literal text.
      const search = input.search?.replace(/[\\%_]/g, '\\$&');
      const where: Prisma.SnippetWhereInput = {
        ownerId,
        category: input.category,
        favorite: input.favorite,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      // One snapshot keeps total and rows consistent if another request writes meanwhile.
      const [data, total] = await db.$transaction(
        [
          db.snippet.findMany({
            where,
            select: publicFields,
            orderBy: [{ [input.sortBy]: input.sortOrder }, { id: 'asc' }],
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          db.snippet.count({ where }),
        ],
        { isolationLevel: 'RepeatableRead' },
      );
      return {
        data,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    },

    async get(ownerId: string, id: string) {
      const snippet = await db.snippet.findFirst({
        where: { id, ownerId },
        select: publicFields,
      });
      if (!snippet)
        throw new HttpError(404, 'SNIPPET_NOT_FOUND', 'Snippet not found');
      return snippet;
    },

    async update(ownerId: string, id: string, input: UpdateSnippet) {
      // Filter ownership in the UPDATE itself; no separate check/write race.
      const [snippet] = await db.snippet.updateManyAndReturn({
        where: { id, ownerId },
        data: input,
        select: publicFields,
      });
      if (!snippet)
        throw new HttpError(404, 'SNIPPET_NOT_FOUND', 'Snippet not found');
      return snippet;
    },

    async remove(ownerId: string, id: string) {
      const result = await db.snippet.deleteMany({ where: { id, ownerId } });
      if (result.count === 0)
        throw new HttpError(404, 'SNIPPET_NOT_FOUND', 'Snippet not found');
    },
  };
}
