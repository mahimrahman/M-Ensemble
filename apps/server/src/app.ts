import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { UPLOAD_ROUTE, uploadDir } from './services/upload.service.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.LOG_LEVEL));

  /**
   * Uploaded posters, served straight off disk.
   *
   * **Outside `/api`, and with its own CORP header.** Helmet defaults
   * `Cross-Origin-Resource-Policy` to `same-origin`, which is right for
   * every JSON route here and wrong for this one: an <img> is a cross-origin
   * *resource*, and the app is never same-origin with the API — the web build
   * runs on 8090, Expo on 8081, this on 4000. With the default, CORS lets the
   * fetch through and the browser then refuses to paint the image, which looks
   * like a broken file rather than a header.
   *
   * Filenames are UUIDs and the bytes never change, so they can be cached for
   * a year and never revalidated. A new poster is a new name.
   */
  app.use(
    UPLOAD_ROUTE,
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
    express.static(uploadDir, { maxAge: '1y', immutable: true, fallthrough: false, index: false }),
  );

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
