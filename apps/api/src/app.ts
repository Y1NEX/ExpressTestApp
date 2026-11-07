import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import helmet from 'helmet';
import cors from 'cors';
import type { PrismaClient } from '@snippet/database';
import type { Config } from './config.js';
import { createPassport } from './auth/passport.js';
import { authRoutes } from './auth/routes.js';
import { snippetRoutes } from './snippets/routes.js';
import { csrfProtection } from './http/csrf.js';
import { errorHandler, HttpError } from './http/errors.js';

export async function createApp(db: PrismaClient, config: Config) {
  const app = express();
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (error) =>
    console.error('Session database connection error', error),
  );
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    tableName: 'sessions',
    createTableIfMissing: false,
  });
  const passport = await createPassport(db);

  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use(express.json({ limit: '512kb' }));
  app.use(
    session({
      name: 'snippet.sid',
      secret: config.SESSION_SECRET,
      store,
      resave: false,
      saveUninitialized: false,
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
      return next(
        new HttpError(
          415,
          'JSON_REQUIRED',
          'Use Content-Type: application/json',
        ),
      );
    next();
  });
  app.use('/api/auth', authRoutes(passport));
  app.use('/api/snippets', snippetRoutes(db));
  app.use((_req, _res, next) =>
    next(new HttpError(404, 'NOT_FOUND', 'Route not found')),
  );
  app.use(errorHandler);

  return {
    app,
    async close() {
      store.close();
      await pool.end();
    },
  };
}
