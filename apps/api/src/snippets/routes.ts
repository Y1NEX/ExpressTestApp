import { Router } from 'express';
import {
  categories,
  createSnippetSchema,
  listSnippetsSchema,
  snippetIdSchema,
  updateSnippetSchema,
  snippetResponseSchema,
  snippetListSchema,
  categoryListResponseSchema,
} from '@snippet/contracts';
import { authenticatedUser, requireAuth } from '../auth/require-auth.js';
import type { SnippetService } from './service.js';
import { asyncHandler } from '../http/async-handler.js';
import { respond } from '../http/respond.js';

export function snippetRoutes(service: SnippetService) {
  const router = Router();
  router.use(requireAuth);
  router.get('/categories', (_req, res) =>
    respond(res, categoryListResponseSchema, { data: [...categories] }),
  );
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      respond(
        res,
        snippetListSchema,
        await service.list(
          authenticatedUser(req).id,
          listSnippetsSchema.parse(req.query),
        ),
      );
    }),
  );
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const snippet = await service.create(
        authenticatedUser(req).id,
        createSnippetSchema.parse(req.body),
      );
      res.location(`/api/snippets/${snippet.id}`);
      respond(res, snippetResponseSchema, { data: snippet }, 201);
    }),
  );
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      respond(res, snippetResponseSchema, {
        data: await service.get(
          authenticatedUser(req).id,
          snippetIdSchema.parse(req.params.id),
        ),
      });
    }),
  );
  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      respond(res, snippetResponseSchema, {
        data: await service.update(
          authenticatedUser(req).id,
          snippetIdSchema.parse(req.params.id),
          updateSnippetSchema.parse(req.body),
        ),
      });
    }),
  );
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await service.remove(
        authenticatedUser(req).id,
        snippetIdSchema.parse(req.params.id),
      );
      res.status(204).end();
    }),
  );
  return router;
}
