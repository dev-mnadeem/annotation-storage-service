import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { User } from '../../src/models/User';
import { hashApiKey } from '../../src/store/users';
import { ADMIN_KEY, asAdmin, asKey, seedImage, squareMask, testApp } from '../helpers/api';

const app = testApp();

describe('API key resolution', () => {
  it('rejects a request with no key', async () => {
    const res = await request(app).get('/api/annotations');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('rejects an unknown key', async () => {
    const res = await asKey(app, 'not-a-real-key-at-all').get('/api/annotations');
    expect(res.status).toBe(401);
  });

  it('accepts the bootstrap admin key from the environment', async () => {
    const res = await asAdmin(app).get('/api/annotations');
    expect(res.status).toBe(200);
  });
});

describe('role enforcement', () => {
  let annotatorKey: string;

  beforeEach(async () => {
    const res = await asAdmin(app)
      .post('/api/users')
      .send({ name: 'Ada', email: 'ada@example.com' });
    annotatorKey = res.body.apiKey as string;
  });

  it('issues a key once and stores only its digest', async () => {
    const stored = await User.findOne({ email: 'ada@example.com' }).select('+apiKeyHash');
    expect(stored?.apiKeyHash).toBe(hashApiKey(annotatorKey));
    expect(stored?.apiKeyHash).not.toBe(annotatorKey);
  });

  it('lets an annotator read', async () => {
    expect((await asKey(app, annotatorKey).get('/api/annotations')).status).toBe(200);
  });

  it('refuses to let an annotator create a project', async () => {
    const res = await asKey(app, annotatorKey).post('/api/projects').send({ name: 'Sneaky' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('refuses to let an annotator issue another key', async () => {
    const res = await asKey(app, annotatorKey)
      .post('/api/users')
      .send({ name: 'Mallory', email: 'm@example.com' });
    expect(res.status).toBe(403);
  });
});

describe('authorship', () => {
  it('records the key holder as the author of a mask', async () => {
    const { imageId } = await seedImage(app);
    const issued = await asAdmin(app)
      .post('/api/users')
      .send({ name: 'Grace', email: 'grace@example.com' });

    const created = await asKey(app, issued.body.apiKey)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10) });

    expect(created.status).toBe(201);
    expect(created.body.createdBy).toBe(issued.body.id);
  });

  it('refuses a request that tries to name a different author', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({
        image: imageId,
        label: 'sign',
        segmentation: squareMask(10),
        createdBy: '652f1a2b3c4d5e6f70819293',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('leaves authorship null for work done with the bootstrap key', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10) });
    expect(res.body.createdBy).toBeNull();
  });
});

describe('the admin key itself', () => {
  it('is not accepted as a prefix or a suffix', async () => {
    expect((await asKey(app, ADMIN_KEY.slice(0, -1)).get('/api/annotations')).status).toBe(401);
    expect((await asKey(app, `${ADMIN_KEY}x`).get('/api/annotations')).status).toBe(401);
  });
});
