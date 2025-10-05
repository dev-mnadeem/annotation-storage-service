import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { parseEnv } from '../../src/config/env';

export const ADMIN_KEY = 'test-admin-key-0123456789';

export function testApp(): Express {
  return createApp(
    parseEnv({
      NODE_ENV: 'test',
      PORT: '7339',
      MONGODB_URI: 'mongodb://unused-in-tests',
      ADMIN_API_KEY: ADMIN_KEY,
      REQUEST_LOG: 'off',
    }),
  );
}

export const asAdmin = (app: Express) => ({
  post: (url: string) => request(app).post(url).set('X-API-Key', ADMIN_KEY),
  patch: (url: string) => request(app).patch(url).set('X-API-Key', ADMIN_KEY),
  get: (url: string) => request(app).get(url).set('X-API-Key', ADMIN_KEY),
});

export const asKey = (app: Express, key: string) => ({
  post: (url: string) => request(app).post(url).set('X-API-Key', key),
  patch: (url: string) => request(app).patch(url).set('X-API-Key', key),
  get: (url: string) => request(app).get(url).set('X-API-Key', key),
});

/** A 200x100 image inside a fresh project, which most API tests need before anything else. */
export async function seedImage(
  app: Express,
  opts: { width?: number; height?: number } = {},
): Promise<{ projectId: string; imageId: string }> {
  const width = opts.width ?? 200;
  const height = opts.height ?? 100;

  const project = await asAdmin(app).post('/api/projects').send({ name: 'Road signs' });
  const projectId = project.body._id as string;

  const images = await asAdmin(app)
    .post(`/api/projects/${projectId}/images`)
    .send({ images: [{ uri: 's3://bucket/frame-001.png', width, height }] });

  return { projectId, imageId: images.body.images[0]._id as string };
}

/** A square polygon of side `side` anchored at the origin, area `side * side`. */
export function squareMask(side: number) {
  return {
    type: 'polygon' as const,
    polygons: [
      {
        rings: [
          [
            [0, 0],
            [side, 0],
            [side, side],
            [0, side],
          ],
        ],
      },
    ],
  };
}
