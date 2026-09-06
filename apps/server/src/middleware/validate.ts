import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { HttpError } from './errorHandler.js';

type Source = 'body' | 'query' | 'params';

/** Parses the given request part with a Zod schema, replacing it with the parsed value. */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new HttpError(400, 'VALIDATION_ERROR', 'Invalid request', result.error.flatten()));
      return;
    }
    Object.assign(req[source] as object, result.data);
    next();
  };
}
