import { Router } from 'express';
import type { PrismaClient } from '@snippet/database';
import {
  categories,
  createSnippetSchema,
  listSnippetsSchema,
  snippetIdSchema,
  updateSnippetSchema,
} from '@snippet/contracts';
import { requireAuth } from '../auth/routes.js';
import { snippetService } from './service.js';

export function snippetRoutes(db: PrismaClient) {
  const router = Router();
  const service = snippetService(db);
  router.use(requireAuth);
  router.get('/categories', (_req, res) => res.json({ data: categories }));
  router.get('/', async (req, res) =>
    res.json(
      await service.list(req.user!.id, listSnippetsSchema.parse(req.query)),
    ),
  );
  router.post('/', async (req, res) => {
    const snippet = await service.create(
      req.user!.id,
      createSnippetSchema.parse(req.body),
    );
    res
      .location(`/api/snippets/${snippet.id}`)
      .status(201)
      .json({ data: snippet });
  });
  router.get('/:id', async (req, res) => {
    res.json({
      data: await service.get(
        req.user!.id,
        snippetIdSchema.parse(req.params.id),
      ),
    });
  });
  router.patch('/:id', async (req, res) => {
    res.json({
      data: await service.update(
        req.user!.id,
        snippetIdSchema.parse(req.params.id),
        updateSnippetSchema.parse(req.body),
      ),
    });
  });
  router.delete('/:id', async (req, res) => {
    await service.remove(req.user!.id, snippetIdSchema.parse(req.params.id));
    res.status(204).end();
  });
  return router;
}
