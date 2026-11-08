import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import helmet from 'helmet';
import cors from 'cors';
import { tca } from '@itsezz/try-catch';
import {
  healthResponseSchema,
  readinessResponseSchema,
} from '@snippet/contracts';
import type { PrismaClient } from '@snippet/database';
import type { Config } from './config.js';
import { createPassport } from './auth/passport.js';
import { authRoutes } from './auth/routes.js';
import { snippetRoutes } from './snippets/routes.js';
import { csrfProtection } from './http/csrf.js';
import { errorHandler } from './http/error-handler.js';
import { ApplicationError } from './core/errors.js';
import { createLogger, errorDiagnostics, type Logger } from './core/logger.js';
import { requestContext } from './http/context.js';
import { respond } from './http/respond.js';
import { asyncHandler } from './http/async-handler.js';
import { createSnippetRepository } from './snippets/repository.js';
import { snippetService } from './snippets/service.js';

export async function createApp(
  db: PrismaClient,
  config: Config,
  logger: Logger = createLogger(config.LOG_LEVEL),
) {
  const app = express();
  let draining = false;
  const passport = await createPassport(db);
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  pool.on('error', (error) =>
    logger.error('session.database_failure', errorDiagnostics(error)),
  );
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    tableName: 'sessions',
    createTableIfMissing: false,
    errorLog: (...args: unknown[]) =>
      logger.error('session.store_failure', errorDiagnostics(args.at(-1))),
  });

  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.set('trust proxy', config.TRUST_PROXY_HOPS || false);
  app.use(requestContext(logger));
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', (_req, res) =>
    respond(res, healthResponseSchema, { status: 'ok' }),
  );
  app.get(
    '/ready',
    asyncHandler(async (_req, res) => {
      if (draining) {
        respond(res, readinessResponseSchema, { status: 'unavailable' }, 503);
        return;
      }
      const result = await tca(
        () =>
          db.$queryRaw<
            { ready: boolean }[]
          >`SELECT to_regclass('public.users') IS NOT NULL AND to_regclass('public.snippets') IS NOT NULL AND to_regclass('public.sessions') IS NOT NULL AS ready`,
      );
      const ready = result.ok && result.data[0]?.ready === true;
      respond(
        res,
        readinessResponseSchema,
        { status: ready ? 'ready' : 'unavailable' },
        ready ? 200 : 503,
      );
    }),
  );
  app.use(express.json({ limit: '512kb', strict: false }));
  app.use(
    session({
      name: 'snippet.sid',
      secret: config.SESSION_SECRET,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(csrfProtection(config.WEB_ORIGIN));
  app.use((req, _res, next) => {
    if (['POST', 'PATCH'].includes(req.method) && !req.is('application/json'))
      return next(new ApplicationError('JSON_REQUIRED'));
    next();
  });
  app.use('/api/auth', authRoutes(passport));
  app.use(
    '/api/snippets',
    snippetRoutes(snippetService(createSnippetRepository(db))),
  );
  app.use((_req, _res, next) => next(new ApplicationError('NOT_FOUND')));
  app.use(errorHandler(logger));

  return {
    app,
    drain() {
      draining = true;
    },
    async close() {
      store.close();
      await pool.end();
    },
  };
}
