import type { ApiErrorCode, ValidationIssue } from '@snippet/contracts';

const definitions = {
  VALIDATION_ERROR: [400, 'Invalid request'],
  INVALID_JSON: [400, 'Request body must be valid JSON'],
  BAD_REQUEST: [400, 'Invalid request'],
  BODY_TOO_LARGE: [413, 'Request body exceeds 512 KB'],
  JSON_REQUIRED: [415, 'Use Content-Type: application/json'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'Unsupported content type or charset'],
  UNSUPPORTED_ENCODING: [415, 'Unsupported content encoding'],
  UNAUTHENTICATED: [401, 'Please log in'],
  INVALID_CREDENTIALS: [401, 'Email or password is incorrect'],
  CSRF_INVALID: [403, 'Fetch a CSRF token and send it as X-CSRF-Token'],
  ORIGIN_FORBIDDEN: [403, 'Origin is not allowed'],
  NOT_FOUND: [404, 'Resource not found'],
  SNIPPET_NOT_FOUND: [404, 'Snippet not found'],
  CONFLICT: [409, 'The operation conflicts with existing data'],
  RATE_LIMITED: [429, 'Too many failed login attempts; try again later'],
  DATABASE_UNAVAILABLE: [503, 'Database is temporarily unavailable'],
  SERVICE_UNAVAILABLE: [503, 'Service is temporarily unavailable'],
  INTERNAL_ERROR: [500, 'An unexpected error occurred'],
} as const satisfies Record<ApiErrorCode, readonly [number, string]>;

export class ApplicationError extends Error {
  readonly status: number;
  constructor(
    readonly code: ApiErrorCode,
    readonly issues?: ValidationIssue[],
  ) {
    const [status, message] = definitions[code];
    super(message);
    this.name = 'ApplicationError';
    this.status = status;
  }
}
