import { describe, expect, it } from 'vitest';
import { asAdmin, asKey, seedImage, squareMask, testApp } from '../helpers/api';

const app = testApp();

describe('POST /api/projects', () => {
  it('creates a project in the active state', async () => {
    const res = await asAdmin(app)
      .post('/api/projects')
      .send({ name: 'Road signs', description: 'Dashcam frames' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.createdBy).toBeNull();
  });

  it('rejects a project with no name', async () => {
    const res = await asAdmin(app).post('/api/projects').send({ description: 'no name' });
    expect(res.status).toBe(400);
  });

  it('rejects an unrecognised field rather than dropping it', async () => {
    const res = await asAdmin(app).post('/api/projects').send({ name: 'x', colour: 'red' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});

describe('GET /api/projects/:id', () => {
  it('400s for an id that is not an object id', async () => {
    expect((await asAdmin(app).get('/api/projects/nope')).status).toBe(400);
  });

  it('404s for an id that no project has', async () => {
    expect((await asAdmin(app).get('/api/projects/652f1a2b3c4d5e6f70819293')).status).toBe(404);
  });
});

describe('GET /api/projects/:id/stats', () => {
  it('counts images, masks, labels and annotators', async () => {
    const { projectId, imageId } = await seedImage(app);
    const issued = await asAdmin(app)
      .post('/api/users')
      .send({ name: 'Ada', email: 'ada@example.com' });

    await asKey(app, issued.body.apiKey)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(5) });
    await asKey(app, issued.body.apiKey)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(6) });
    await asKey(app, issued.body.apiKey)
      .post('/api/annotations')
      .send({ image: imageId, label: 'road', segmentation: squareMask(7) });

    const res = await asAdmin(app).get(`/api/projects/${projectId}/stats`);

    expect(res.body.images).toBe(1);
    expect(res.body.annotations).toBe(3);
    expect(res.body.perLabel).toEqual([
      { label: 'sign', count: 2 },
      { label: 'road', count: 1 },
    ]);
    expect(res.body.perAnnotator).toEqual([
      { annotator: issued.body.id, count: 3, user: { name: 'Ada', email: 'ada@example.com' } },
    ]);
  });

  it('reports zeros for a project nobody has touched', async () => {
    const project = await asAdmin(app).post('/api/projects').send({ name: 'Empty' });
    const res = await asAdmin(app).get(`/api/projects/${project.body._id}/stats`);
    expect(res.body).toMatchObject({ images: 0, annotations: 0, perLabel: [], perAnnotator: [] });
  });

  it('404s for a project that does not exist', async () => {
    const res = await asAdmin(app).get('/api/projects/652f1a2b3c4d5e6f70819293/stats');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/projects/:id/export', () => {
  it('emits a COCO document covering the project', async () => {
    const { projectId, imageId } = await seedImage(app, { width: 40, height: 40 });
    await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10) });
    await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'road', segmentation: squareMask(20) });

    const res = await asAdmin(app).get(`/api/projects/${projectId}/export`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain(`coco-${projectId}.json`);
    expect(res.body.info).toMatchObject({ description: 'Road signs', exported_count: 2 });
    expect(res.body.images.length).toBe(1);
    expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual(['road', 'sign']);
    expect(
      res.body.annotations
        .map((a: { area: number }) => a.area)
        .sort((a: number, b: number) => a - b),
    ).toEqual([100, 400]);
  });

  it('gives every exported annotation a bbox inside its image', async () => {
    const { projectId, imageId } = await seedImage(app, { width: 40, height: 40 });
    await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10) });

    const res = await asAdmin(app).get(`/api/projects/${projectId}/export`);
    expect(res.body.annotations[0].bbox).toEqual([0, 0, 10, 10]);
  });

  it('exports an empty but well-formed document for an untouched project', async () => {
    const project = await asAdmin(app).post('/api/projects').send({ name: 'Empty' });
    const res = await asAdmin(app).get(`/api/projects/${project.body._id}/export`);
    expect(res.body).toMatchObject({ images: [], categories: [], annotations: [] });
  });
});
