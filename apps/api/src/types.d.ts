import type { PublicUser } from '@snippet/contracts';

declare global {
  namespace Express {
    interface User extends PublicUser {}
  }
}

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}
