import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // One in-memory mongod, one database. Files that reseed in `beforeEach`
    // would race each other otherwise.
    fileParallelism: false,
    // The first run downloads a mongod binary.
    hookTimeout: 180_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      // Overrides apps/server/.env — dotenv never replaces an existing key, so
      // this is the guard that keeps the suite off the real Atlas cluster.
      MONGODB_URI: 'mongodb://127.0.0.1:0/placeholder',
      JWT_SECRET: 'test-secret-not-a-real-one',
      CORS_ORIGIN: '*',
      LOG_LEVEL: 'tiny',
      // Uploads land in a scratch folder, not the real ./uploads — a test run
      // must not leave images in the directory the dev server serves.
      UPLOAD_DIR: './tests/.uploads',
    },
  },
});
