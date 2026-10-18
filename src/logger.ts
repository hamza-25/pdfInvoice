import pino from 'pino';

/**
 * Application logger.
 *
 * - Level comes from `LOG_LEVEL` (default `info`, `silent` under test).
 * - When `LOG_FILE` is set, logs are written there synchronously instead of
 *   stdout (also used by the test suite to capture log output).
 */
const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

export const logger = process.env.LOG_FILE
  ? pino({ level }, pino.destination({ dest: process.env.LOG_FILE, sync: true }))
  : pino({ level });
