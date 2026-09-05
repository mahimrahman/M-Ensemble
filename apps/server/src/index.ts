import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';

async function main(): Promise<void> {
  await connectDatabase();

  const server = createApp().listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => async () => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
