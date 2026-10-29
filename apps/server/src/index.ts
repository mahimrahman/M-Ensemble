import * as Sentry from '@sentry/node';
import { assertProductionConfig, env } from './config/env.js';
import { logger } from './utils/logger.js';

// Before anything else: a misconfigured production box must not get as far as
// opening a port, and Sentry has to exist before the first thing that can fail.
assertProductionConfig();

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
}

// Dynamic so the config guard and Sentry run before the app module graph
// (models, routes, the upload dir) is evaluated.
const [{ createApp }, { connectDatabase, disconnectDatabase }, { ensureUploadDir }] =
  await Promise.all([
    import('./app.js'),
    import('./config/db.js'),
    import('./services/upload.service.js'),
  ]);

async function main(): Promise<void> {
  await connectDatabase();
  await ensureUploadDir();

  const server = createApp().listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `[server] listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string) => async () => {
    logger.info(`[server] ${signal} received, shutting down`);
    server.close();
    await disconnectDatabase();
    await Sentry.close(2000).catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

// Anything that escapes a request handler. Logged and reported; the process
// carries on for a rejection (the request that caused it already failed) and
// stops for an exception, since the heap may be inconsistent.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, '[server] unhandled rejection');
  Sentry.captureException(reason);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '[server] uncaught exception');
  Sentry.captureException(err);
  void Sentry.close(2000).finally(() => process.exit(1));
});

main().catch(async (err) => {
  logger.fatal({ err }, '[server] failed to start');
  Sentry.captureException(err);
  await Sentry.close(2000).catch(() => {});
  process.exit(1);
});
