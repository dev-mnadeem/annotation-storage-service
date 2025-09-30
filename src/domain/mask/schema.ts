import { z } from 'zod';
import { MIN_RING_VERTICES } from '../../config/constants';
import type { Segmentation } from './types';

const vertexZ = z.tuple([z.number().finite(), z.number().finite()]);
const ringZ = z.array(vertexZ).min(MIN_RING_VERTICES);
const polygonZ = z.object({ rings: z.array(ringZ).min(1) });

export const PolygonSegmentationZ = z.object({
  type: z.literal('polygon'),
  polygons: z.array(polygonZ).min(1),
});

export const RleSegmentationZ = z.object({
  type: z.literal('rle'),
  size: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  counts: z.array(z.number().int().nonnegative()).min(1),
});

/**
 * Shape-level validation only: this says the payload is a well-typed polygon or RLE.
 * Whether it is a *legal mask for a given image* is decided by the check registry,
 * which needs the image dimensions that this schema cannot see.
 */
export const SegmentationZ = z.discriminatedUnion('type', [PolygonSegmentationZ, RleSegmentationZ]);

export type SegmentationInput = z.infer<typeof SegmentationZ>;

export function parseSegmentation(input: unknown): Segmentation {
  return SegmentationZ.parse(input) as Segmentation;
}
