import type {
  CreateSnippet,
  ListSnippets,
  UpdateSnippet,
  Snippet,
} from '@snippet/contracts';
import type { Prisma, PrismaClient } from '@snippet/database';

export type SnippetRecord = Omit<Snippet, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};
export interface SnippetRepository {
  create(ownerId: string, input: CreateSnippet): Promise<SnippetRecord>;
  list(
    ownerId: string,
    input: ListSnippets,
  ): Promise<{ data: SnippetRecord[]; total: number }>;
  get(ownerId: string, id: string): Promise<SnippetRecord | null>;
  update(
    ownerId: string,
    id: string,
    input: UpdateSnippet,
  ): Promise<SnippetRecord | null>;
  remove(ownerId: string, id: string): Promise<boolean>;
}

const publicFields = {
  id: true,
  title: true,
  content: true,
  category: true,
  favorite: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createSnippetRepository(db: PrismaClient): SnippetRepository {
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
      return { data, total };
    },

    async get(ownerId: string, id: string) {
      return db.snippet.findFirst({
        where: { id, ownerId },
        select: publicFields,
      });
    },

    async update(ownerId: string, id: string, input: UpdateSnippet) {
      // Filter ownership in the UPDATE itself; no separate check/write race.
      const [snippet] = await db.snippet.updateManyAndReturn({
        where: { id, ownerId },
        data: input,
        select: publicFields,
      });
      return snippet ?? null;
    },

    async remove(ownerId: string, id: string) {
      const result = await db.snippet.deleteMany({ where: { id, ownerId } });
      return result.count > 0;
    },
  };
}
