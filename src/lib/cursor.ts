import { isValidObjectId } from 'mongoose';
import { ApiError } from './ApiError';

/**
 * Keyset pagination tokens.
 *
 * Annotation lists are sorted by `_id` descending, which for ObjectIds is insertion order.
 * A cursor therefore only has to carry the last id seen, and the next page is
 * `{ _id: { $lt: <that id> } }` — an index seek whose cost does not grow with page depth,
 * unlike `skip((page - 1) * limit)`.
 *
 * The token is base64url so that clients treat it as opaque rather than doing id arithmetic.
 */
export function encodeCursor(lastId: string): string {
  return Buffer.from(lastId, 'utf8').toString('base64url');
}

export function decodeCursor(token: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    throw ApiError.badRequest('invalid_cursor', 'cursor is not a valid pagination token');
  }
  if (!isValidObjectId(decoded)) {
    throw ApiError.badRequest('invalid_cursor', 'cursor is not a valid pagination token');
  }
  return decoded;
}
