/**
 * The only error type route code is expected to throw. `code` is a stable machine-readable
 * string that clients can branch on; `message` is for humans and may be reworded.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'A valid X-API-Key header is required'): ApiError {
    return new ApiError(401, 'unauthenticated', message);
  }

  static forbidden(message = 'This action requires the admin role'): ApiError {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(what: string): ApiError {
    return new ApiError(404, 'not_found', `${what} not found`);
  }

  static conflict(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(409, code, message, details);
  }
}
