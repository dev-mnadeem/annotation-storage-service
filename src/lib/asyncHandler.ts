import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 does not await handlers, so a rejected promise would otherwise hang the request. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
