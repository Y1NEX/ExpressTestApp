export type LogLevel = 'info' | 'warn' | 'error' | 'silent';
export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

const ranks: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
  silent: 3,
};
export function createLogger(
  level: LogLevel,
  write = (line: string) => {
    process.stdout.write(`${line}\n`);
  },
): Logger {
  const log = (
    severity: Exclude<LogLevel, 'silent'>,
    event: string,
    fields: Record<string, unknown> = {},
  ) => {
    if (ranks[severity] >= ranks[level])
      write(
        JSON.stringify({
          ...fields,
          time: new Date().toISOString(),
          level: severity,
          event,
        }),
      );
  };
  return {
    info: (event, fields) => log('info', event, fields),
    warn: (event, fields) => log('warn', event, fields),
    error: (event, fields) => log('error', event, fields),
  };
}

// Log only explicitly allowed diagnostics. Error messages can contain SQL or credentials.
export function errorDiagnostics(error: unknown): Record<string, unknown> {
  return {
    errorType: error instanceof Error ? error.name : typeof error,
    ...(error instanceof Error && error.stack
      ? {
          frames: error.stack
            .split('\n')
            .filter((line) => /^\s+at .+:\d+:\d+\)?$/.test(line))
            .slice(0, 8),
        }
      : {}),
    ...(error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{1,40}$/.test(error.code)
      ? { causeCode: error.code }
      : {}),
  };
}
