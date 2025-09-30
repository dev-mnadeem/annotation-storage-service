import { describe, expect, it } from 'vitest';
import { asAdmin, seedImage, squareMask, testApp } from '../helpers/api';

const app = testApp();

describe('POST /api/projects/:projectId/images', () => {
  it('bulk inserts and reports how many landed', async () => {
    const project = await asAdmin(app).post('/api/projects').send({ name: 'Frames' });
    const res = await asAdmin(app)
      .post(`/api/projects/${project.body._id}/images`)
      .send({
        images: [
          { uri: 's3://b/1.png', width: 640, height: 480 },
          { uri: 's3://b/2.png', width: 640, height: 480 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(2);
    expect(res.body.images[0].status).toBe('unassigned');
  });

  it('rejects an image with no dimensions', async () => {
    const project = await asAdmin(app).post('/api/projects').send({ name: 'Frames' });
    const res = await asAdmin(app)
      .post(`/api/projects/${project.body._id}/images`)
      .send({ images: [{ uri: 's3://b/1.png' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('rejects a zero-width image, which no mask could ever fit', async () => {
    const project = await asAdmin(app).post('/api/projects').send({ name: 'Frames' });
    const res = await asAdmin(app)
      .post(`/api/projects/${project.body._id}/images`)
      .send({ images: [{ uri: 's3://b/1.png', width: 0, height: 480 }] });
    expect(res.status).toBe(400);
  });

  it('404s for a project that does not exist', async () => {
    const res = await asAdmin(app)
      .post('/api/projects/652f1a2b3c4d5e6f70819293/images')
      .send({ images: [{ uri: 's3://b/1.png', width: 1, height: 1 }] });
    expect(res.status).toBe(404);
  });

  it('rejects an empty batch', async () => {
    const project = await asAdmin(app).post('/api/projects').send({ name: 'Frames' });
    const res = await asAdmin(app)
      .post(`/api/projects/${project.body._id}/images`)
      .send({ images: [] });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/images/:id/status', () => {
  it('claims an unassigned image', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .patch(`/api/images/${imageId}/status`)
      .send({ action: 'assign' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ from: 'unassigned', to: 'in_progress' });
  });

  it('refuses an action the lifecycle does not allow and says what would be', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .patch(`/api/images/${imageId}/status`)
      .send({ action: 'release' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('illegal_transition');
    expect(res.body.error.details.allowed.sort()).toEqual(['annotate', 'assign']);
  });

  it('reopens finished work instead of unclaiming it', async () => {
    const { imageId } = await seedImage(app);
    await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10) });

    const release = await asAdmin(app)
      .patch(`/api/images/${imageId}/status`)
      .send({ action: 'release' });
    expect(release.status).toBe(409);

    const reopen = await asAdmin(app)
      .patch(`/api/images/${imageId}/status`)
      .send({ action: 'reopen' });
    expect(reopen.body).toMatchObject({ from: 'annotated', to: 'in_progress' });
  });

  it('rejects an action that is not in the lifecycle at all', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .patch(`/api/images/${imageId}/status`)
      .send({ action: 'incinerate' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/images/:id/masks', () => {
  it('ranks every mask on the image in one request', async () => {
    const { imageId } = await seedImage(app);
    for (const side of [4, 9, 6]) {
      await asAdmin(app)
        .post('/api/annotations')
        .send({ image: imageId, label: `s${side}`, segmentation: squareMask(side) });
    }

    const res = await asAdmin(app).get(`/api/images/${imageId}/masks`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.masks.map((m: { area: number }) => m.area)).toEqual([81, 36, 16]);
    expect(res.body.masks.map((m: { rank: number }) => m.rank)).toEqual([1, 2, 3]);
  });

  it('agrees with the per-annotation rank endpoint', async () => {
    const { imageId } = await seedImage(app);
    const created = [];
    for (const side of [3, 8]) {
      created.push(
        await asAdmin(app)
          .post('/api/annotations')
          .send({ image: imageId, label: 'x', segmentation: squareMask(side) }),
      );
    }

    const list = await asAdmin(app).get(`/api/images/${imageId}/masks`);
    for (const res of created) {
      const single = await asAdmin(app).get(`/api/annotations/${res.body._id}/rank`);
      const inList = list.body.masks.find((m: { id: string }) => m.id === res.body._id);
      expect(inList.rank).toBe(single.body.rank);
    }
  });

  it('returns an empty list for an image nobody has annotated', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app).get(`/api/images/${imageId}/masks`);
    expect(res.body).toMatchObject({ total: 0, masks: [] });
  });

  it('404s for an unknown image', async () => {
    expect((await asAdmin(app).get('/api/images/652f1a2b3c4d5e6f70819293/masks')).status).toBe(404);
  });
});
