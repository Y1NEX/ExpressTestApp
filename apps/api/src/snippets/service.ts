import type {
  CreateSnippet,
  ListSnippets,
  Snippet,
  SnippetList,
  UpdateSnippet,
} from '@snippet/contracts';
import type { SnippetRecord, SnippetRepository } from './repository.js';
import { ApplicationError } from '../core/errors.js';

function toDto(record: SnippetRecord): Snippet {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function snippetService(repository: SnippetRepository) {
  return {
    async create(ownerId: string, input: CreateSnippet): Promise<Snippet> {
      return toDto(await repository.create(ownerId, input));
    },
    async list(ownerId: string, input: ListSnippets): Promise<SnippetList> {
      const { data, total } = await repository.list(ownerId, input);
      return {
        data: data.map(toDto),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    },
    async get(ownerId: string, id: string): Promise<Snippet> {
      const record = await repository.get(ownerId, id);
      if (!record) throw new ApplicationError('SNIPPET_NOT_FOUND');
      return toDto(record);
    },
    async update(
      ownerId: string,
      id: string,
      input: UpdateSnippet,
    ): Promise<Snippet> {
      const record = await repository.update(ownerId, id, input);
      if (!record) throw new ApplicationError('SNIPPET_NOT_FOUND');
      return toDto(record);
    },
    async remove(ownerId: string, id: string): Promise<void> {
      if (!(await repository.remove(ownerId, id)))
        throw new ApplicationError('SNIPPET_NOT_FOUND');
    },
  };
}
export type SnippetService = ReturnType<typeof snippetService>;
