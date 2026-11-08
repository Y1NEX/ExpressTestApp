import type { PublicUser } from '@snippet/contracts';

declare global {
  namespace Express {
    interface User extends PublicUser {}
    interface Request {
      requestId: string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}
