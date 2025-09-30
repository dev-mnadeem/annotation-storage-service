import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env';

const valid = {
  MONGODB_URI: 'mongodb://localhost:27017/seg',
  ADMIN_API_KEY: 'a-sufficiently-long-key',
};

describe('parseEnv', () => {
  it('defaults the port to 7331', () => {
    expect(parseEnv(valid).PORT).toBe(7331);
  });

  it('coerces a port given as a string', () => {
    expect(parseEnv({ ...valid, PORT: '7332' }).PORT).toBe(7332);
  });

  it('refuses to start without a database URI', () => {
    expect(() => parseEnv({ ADMIN_API_KEY: valid.ADMIN_API_KEY })).toThrow(/MONGODB_URI/);
  });

  it('refuses a short admin key', () => {
    expect(() => parseEnv({ ...valid, ADMIN_API_KEY: 'admin' })).toThrow(/ADMIN_API_KEY/);
  });

  it('rejects an unknown request log format', () => {
    expect(() => parseEnv({ ...valid, REQUEST_LOG: 'verbose' })).toThrow(/REQUEST_LOG/);
  });
});
