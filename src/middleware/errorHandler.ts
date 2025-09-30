import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/ApiError';

/** Every error response in the service has this shape, whatever threw it. */
export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function notFoundHandler(req: Request, res: Response<ErrorBody>): void {
  res.status(404).json({
    error: { code: 'no_such_route', message: `${req.method} ${req.path} is not a route` },
  });
}

function describe(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'validation_failed',
          message: 'Request failed validation',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      },
    };
  }
  if (err instanceof Error && err.name === 'ValidationError') {
    return { status: 400, body: { error: { code: 'validation_failed', message: err.message } } };
  }
  if (
    err instanceof Error &&
    err.name === 'MongoServerError' &&
    'code' in err &&
    err.code === 11000
  ) {
    return {
      status: 409,
      body: { error: { code: 'duplicate_key', message: 'A record with that key already exists' } },
    };
  }
  return {
    status: 500,
    body: { error: { code: 'internal_error', message: 'Internal Server Error' } },
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ErrorBody>,
  _next: NextFunction,
): void {
  const { status, body } = describe(err);
  // An unexpected error is a defect in this service, so it is logged in full rather than
  // being reduced to the generic message the client receives.
  if (status >= 500) console.error(err);
  res.status(status).json(body);
}
