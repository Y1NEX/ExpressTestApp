import { Prisma } from '@snippet/database';
import { ApplicationError } from '../core/errors.js';

const unavailableCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2037',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  '57P01',
  '53300',
  '08006',
  '57014',
  '28P01',
  '28000',
  '3D000',
]);
export function mapPrismaError(error: unknown): ApplicationError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2039') {
      const adapter = error.meta?.driverAdapterError;
      const cause =
        adapter && typeof adapter === 'object' && 'cause' in adapter
          ? adapter.cause
          : null;
      const sqlState =
        cause && typeof cause === 'object' && 'originalCode' in cause
          ? cause.originalCode
          : null;
      if (
        typeof sqlState === 'string' &&
        ['23514', '23502', '22001'].includes(sqlState)
      )
        return new ApplicationError('VALIDATION_ERROR');
      if (typeof sqlState === 'string' && ['23505', '23503'].includes(sqlState))
        return new ApplicationError('CONFLICT');
      if (sqlState === '57014')
        return new ApplicationError('DATABASE_UNAVAILABLE');
    }
    if (unavailableCodes.has(error.code))
      return new ApplicationError('DATABASE_UNAVAILABLE');
    if (['P2002', 'P2003', 'P2014', 'P2034'].includes(error.code))
      return new ApplicationError('CONFLICT');
    if (error.code === 'P2025') return new ApplicationError('NOT_FOUND');
    if (['P2000', 'P2004', 'P2011'].includes(error.code))
      return new ApplicationError('VALIDATION_ERROR');
    if (error.code === 'P2010' && typeof error.meta?.code === 'string') {
      if (unavailableCodes.has(error.meta.code))
        return new ApplicationError('DATABASE_UNAVAILABLE');
      if (['23505', '23503'].includes(error.meta.code))
        return new ApplicationError('CONFLICT');
      if (['23514', '23502', '22001'].includes(error.meta.code))
        return new ApplicationError('VALIDATION_ERROR');
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError)
    return new ApplicationError('DATABASE_UNAVAILABLE');
  // Session-store failures come from node-postgres rather than Prisma.
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    unavailableCodes.has(error.code)
  )
    return new ApplicationError('DATABASE_UNAVAILABLE');
  return null;
}
