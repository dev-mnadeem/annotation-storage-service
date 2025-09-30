import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '../../src/lib/cursor';
import { ApiError } from '../../src/lib/ApiError';

const id = '652f1a2b3c4d5e6f70819293';

describe('pagination cursors', () => {
  it('round-trips an object id', () => {
    expect(decodeCursor(encodeCursor(id))).toBe(id);
  });

  it('produces a token that is not the raw id', () => {
    expect(encodeCursor(id)).not.toBe(id);
  });

  it('rejects a token that does not decode to an object id', () => {
    expect(() => decodeCursor(Buffer.from('nonsense').toString('base64url'))).toThrow(ApiError);
  });

  it('rejects an arbitrary string', () => {
    expect(() => decodeCursor('!!!!')).toThrow(/pagination token/);
  });
});
