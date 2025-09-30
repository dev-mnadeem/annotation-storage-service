import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_KEY, testApp } from '../helpers/api';

vi.mock('../../src/config/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/db')>();
  return {
    ...actual,
    isDbConnected: () => connected,
    dbStateName: () => (connected ? 'connected' : 'disconnected'),
  };
});

let connected = true;

describe('GET /api/health', () => {
  it('answers without an API key, because a probe has no identity', async () => {
    connected = true;
    const res = await request(testApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db.state).toBe('connected');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('reports 503 while the database is unreachable', async () => {
    connected = false;
    const res = await request(testApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    connected = true;
  });
});

describe('unknown routes', () => {
  it('names the method and path it could not route', async () => {
    const res = await request(testApp()).get('/api/nope').set('X-API-Key', ADMIN_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('no_such_route');
    expect(res.body.error.message).toContain('/api/nope');
  });

  it('answers an unauthenticated caller with 401 before revealing whether a route exists', async () => {
    expect((await request(testApp()).get('/api/nope')).status).toBe(401);
  });

  it('still 404s outside the API prefix', async () => {
    const res = await request(testApp()).get('/favicon.ico');
    expect(res.status).toBe(404);
  });
});

describe('request bodies the JSON parser refuses', () => {
  it('answers malformed JSON with a 400 rather than an internal error', async () => {
    const res = await request(testApp())
      .post('/api/projects')
      .set('X-API-Key', ADMIN_KEY)
      .set('Content-Type', 'application/json')
      .send('{"name": "Road signs"');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });

  it('answers a body over the size cap with a 413', async () => {
    const padding = 'x'.repeat(11 * 1024 * 1024);
    const res = await request(testApp())
      .post('/api/annotations')
      .set('X-API-Key', ADMIN_KEY)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ metadata: { padding } }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });
});
