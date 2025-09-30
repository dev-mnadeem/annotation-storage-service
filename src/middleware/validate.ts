import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../lib/ApiError';

type Part = 'body' | 'query' | 'params';

function issues(err: ZodError): { path: string; message: string }[] {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/**
 * Parses one part of the request and replaces it with the parsed value, so handlers receive
 * coerced, narrowed data instead of `string | string[] | undefined` from the query string.
 */
export function validate(part: Part, schema: ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(
        ApiError.badRequest('validation_failed', `Invalid request ${part}`, issues(result.error)),
      );
    }
    Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
    next();
  };
}
