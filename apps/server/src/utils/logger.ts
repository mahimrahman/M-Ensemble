/**
 * The one logger. `pino`: JSON lines in production for whatever ships them to
 * a log store, pretty-printed on a laptop. Replaces every `console.log` in
 * the server so a line can carry structured fields and a level.
 *
 * Under test it is silent unless `LOG_LEVEL=debug` — 159 tests' worth of
 * request logs is noise nobody reads.
 */

import { createRequire } from 'node:module';
import pino from 'pino';
import { env, isProduction, isTest } from '../config/env.js';

const level = isTest
  ? process.env.LOG_LEVEL === 'debug'
    ? 'debug'
    : 'silent'
  : process.env.PINO_LEVEL ?? (isProduction ? 'info' : 'debug');

function hasPinoPretty(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

export const logger = pino({
  level,
  base: { service: 'm-ensemble-api', env: env.NODE_ENV },
  // Pretty output on a laptop only. In production the raw JSON is what the
  // log shipper wants, and pino-pretty is a devDependency — so it is also
  // skipped when absent, which is what a production image run with
  // NODE_ENV=development looks like.
  ...(isProduction || isTest || !hasPinoPretty()
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service,env' },
        },
      }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.newPassword',
      '*.currentPassword',
    ],
    censor: '[redacted]',
  },
});
