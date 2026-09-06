import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not catch rejected promises — an `await` that throws inside a
 * bare handler becomes an unhandled rejection and the request hangs until the
 * client times out. Every async handler in this server goes through here so the
 * rejection reaches `errorHandler` instead.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
