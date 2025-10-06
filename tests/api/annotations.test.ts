import { describe, expect, it } from 'vitest';
import { asAdmin, seedImage, squareMask, testApp } from '../helpers/api';

const app = testApp();

describe('POST /api/annotations', () => {
  it('stores a polygon mask and the area it computed', async () => {
    const { projectId, imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10) });

    expect(res.status).toBe(201);
    expect(res.body.area).toBe(100);
    expect(res.body.project).toBe(projectId);
  });

  it('derives the project from the image rather than from the request', async () => {
    const { projectId, imageId } = await seedImage(app);
    const other = await asAdmin(app).post('/api/projects').send({ name: 'Other' });

    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({
        image: imageId,
        project: other.body._id,
        label: 'sign',
        segmentation: squareMask(10),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('project_mismatch');
    expect(res.body.error.message).toContain(projectId);
  });

  it('stores its own area when the client sends a matching one', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10), area: 100 });
    expect(res.status).toBe(201);
    expect(res.body.area).toBe(100);
  });

  it('rejects a client area that disagrees with the geometry', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10), area: 12 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('mask_rejected');
    expect(res.body.error.details.map((d: { code: string }) => d.code)).toContain('area_mismatch');
  });

  it('rejects a polygon drawn outside the image', async () => {
    const { imageId } = await seedImage(app, { width: 50, height: 50 });
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(400) });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { code: string }) => d.code)).toContain(
      'polygon_out_of_bounds',
    );
  });

  it('rejects an RLE run list that does not cover the frame', async () => {
    const { imageId } = await seedImage(app, { width: 20, height: 10 });
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({
        image: imageId,
        label: 'road',
        segmentation: { type: 'rle', size: [10, 20], counts: [5, 5] },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { code: string }) => d.code)).toContain(
      'rle_counts_incomplete',
    );
  });

  it('accepts an RLE mask that covers the frame exactly', async () => {
    const { imageId } = await seedImage(app, { width: 20, height: 10 });
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({
        image: imageId,
        label: 'road',
        segmentation: { type: 'rle', size: [10, 20], counts: [100, 100] },
      });

    expect(res.status).toBe(201);
    expect(res.body.area).toBe(100);
  });

  it('rejects a ring with fewer than three vertices at the schema', async () => {
    const { imageId } = await seedImage(app);
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({
        image: imageId,
        label: 'sign',
        segmentation: {
          type: 'polygon',
          polygons: [
            {
              rings: [
                [
                  [0, 0],
                  [5, 5],
                ],
              ],
            },
          ],
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('404s for an image that does not exist', async () => {
    const res = await asAdmin(app)
      .post('/api/annotations')
      .send({
        image: '652f1a2b3c4d5e6f70819293',
        label: 'sign',
        segmentation: squareMask(10),
      });
    expect(res.status).toBe(404);
  });

  it('moves the image to annotated', async () => {
    const { imageId } = await seedImage(app);
    await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'sign', segmentation: squareMask(10) });

    const image = await asAdmin(app).get(`/api/images/${imageId}`);
    expect(image.body.status).toBe('annotated');
  });
});

describe('GET /api/annotations', () => {
  async function seedMasks(count: number): Promise<string> {
    const { imageId } = await seedImage(app);
    for (let i = 0; i < count; i++) {
      await asAdmin(app)
        .post('/api/annotations')
        .send({ image: imageId, label: i % 2 ? 'sign' : 'road', segmentation: squareMask(i + 2) });
    }
    return imageId;
  }

  it('walks every annotation exactly once across keyset pages', async () => {
    await seedMasks(7);
    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const url: string = `/api/annotations?limit=3${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await asAdmin(app).get(url);
      expect(res.status).toBe(200);
      seen.push(...res.body.items.map((i: { _id: string }) => i._id));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(seen.length).toBe(7);
    expect(new Set(seen).size).toBe(7);
  });

  it('returns a null cursor on the last page', async () => {
    await seedMasks(2);
    const res = await asAdmin(app).get('/api/annotations?limit=50');
    expect(res.body.nextCursor).toBeNull();
  });

  it('filters by label', async () => {
    await seedMasks(6);
    const res = await asAdmin(app).get('/api/annotations?label=sign&limit=100');
    expect(res.body.items.length).toBe(3);
    expect(res.body.items.every((i: { label: string }) => i.label === 'sign')).toBe(true);
  });

  it('rejects a limit above the maximum page size', async () => {
    const res = await asAdmin(app).get('/api/annotations?limit=500');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('rejects a cursor that is not a pagination token', async () => {
    const res = await asAdmin(app).get('/api/annotations?cursor=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_cursor');
  });

  it('rejects an annotator filter that is not an object id', async () => {
    const res = await asAdmin(app).get('/api/annotations?annotator=bob');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/annotations/:id/rank', () => {
  it('ranks the largest mask on the image first', async () => {
    const { imageId } = await seedImage(app);
    const small = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'a', segmentation: squareMask(5) });
    const large = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'b', segmentation: squareMask(20) });

    const first = await asAdmin(app).get(`/api/annotations/${large.body._id}/rank`);
    const second = await asAdmin(app).get(`/api/annotations/${small.body._id}/rank`);

    expect(first.body).toMatchObject({ rank: 1, total: 2, area: 400 });
    expect(second.body).toMatchObject({ rank: 2, total: 2, area: 25 });
  });

  it('gives equal areas the same rank', async () => {
    const { imageId } = await seedImage(app);
    const one = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'a', segmentation: squareMask(9) });
    const two = await asAdmin(app)
      .post('/api/annotations')
      .send({ image: imageId, label: 'b', segmentation: squareMask(9) });

    const a = await asAdmin(app).get(`/api/annotations/${one.body._id}/rank`);
    const b = await asAdmin(app).get(`/api/annotations/${two.body._id}/rank`);
    expect(a.body.rank).toBe(1);
    expect(b.body.rank).toBe(1);
  });

  it('404s for an unknown annotation', async () => {
    const res = await asAdmin(app).get('/api/annotations/652f1a2b3c4d5e6f70819293/rank');
    expect(res.status).toBe(404);
  });

  it('400s for an id that is not an object id', async () => {
    const res = await asAdmin(app).get('/api/annotations/banana/rank');
    expect(res.status).toBe(400);
  });
});
