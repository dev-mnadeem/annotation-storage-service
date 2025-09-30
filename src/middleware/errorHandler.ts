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

/**
 * body-parser rejects a request before any route runs, by throwing an error that carries its
 * own 4xx status and a `type`. Without this mapping a truncated JSON body or an oversized RLE
 * run list would be reported, and logged, as a defect in this service.
 */
const BODY_ERROR_CODES: Record<string, string> = {
  'entity.parse.failed': 'invalid_json',
  'entity.too.large': 'payload_too_large',
  'encoding.unsupported': 'unsupported_encoding',
  'charset.unsupported': 'unsupported_encoding',
};

function isBodyParserError(err: unknown): err is Error & { status: number; type: string } {
  return (
    err instanceof Error &&
    'type' in err &&
    typeof err.type === 'string' &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}

function describe(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }
  if (isBodyParserError(err)) {
    return {
      status: err.status,
      body: { error: { code: BODY_ERROR_CODES[err.type] ?? 'bad_request', message: err.message } },
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
