import type { Response } from 'express';
import type { z } from 'zod';

export function respond<T>(
  res: Response,
  schema: z.ZodType<T>,
  payload: T,
  status = 200,
): void {
  const parsed = schema.safeParse(payload);
  // A broken server response is an internal error, not a client validation error.
  if (!parsed.success) throw new Error('Response contract violated');
  res.status(status).json(parsed.data);
}
