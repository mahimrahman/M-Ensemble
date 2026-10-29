import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import type { ApiError } from '@m-ensemble/shared';
import { ERROR } from '../utils/errors.js';
import { ok } from '../utils/respond.js';

export const healthRouter = Router();

/**
 * 200 only when Mongo is actually reachable. A process that is up but cannot
 * read its database must fail the check, or the load balancer keeps sending
 * it traffic that 500s — the one state a health check exists to catch.
 */
function health(_req: Request, res: Response): void {
  const connected = mongoose.connection.readyState === 1;
  const data = {
    status: connected ? 'up' : 'down',
    db: connected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  };
  if (connected) {
    ok(res, data);
    return;
  }
  const body: ApiError = {
    ok: false,
    error: { code: ERROR.UNAVAILABLE, message: 'Database disconnected', details: data },
  };
  res.status(503).json(body);
}

healthRouter.get('/', health);
/** What a Kubernetes/Render-style readiness probe is usually configured to hit. */
healthRouter.get('/ready', health);
