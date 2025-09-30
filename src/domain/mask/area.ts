import { MIN_RING_VERTICES } from '../../config/constants';
import type { BBox, PolygonSegmentation, RLESegmentation, Ring, Segmentation } from './types';

/**
 * Shoelace area of a ring, unsigned. Winding order is not meaningful here: callers subtract
 * hole rings explicitly rather than relying on clients to wind holes the other way.
 */
export function ringArea(ring: Ring): number {
  if (!Array.isArray(ring) || ring.length < MIN_RING_VERTICES) return 0;
  let doubled = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    doubled += x1 * y2 - x2 * y1;
  }
  return Math.abs(doubled) / 2;
}

export function computePolygonArea(seg: PolygonSegmentation): number {
  let total = 0;
  for (const poly of seg.polygons) {
    if (!poly.rings.length) continue;
    const [outer, ...holes] = poly.rings;
    const holesArea = holes.reduce((acc, ring) => acc + ringArea(ring), 0);
    total += Math.max(0, ringArea(outer) - holesArea);
  }
  return total;
}

/** Foreground pixels are the odd-indexed runs, because `counts` starts with background. */
export function computeRleArea(seg: RLESegmentation): number {
  let area = 0;
  for (let i = 1; i < seg.counts.length; i += 2) {
    area += seg.counts[i];
  }
  return area;
}

export function computeSegmentationArea(seg: Segmentation): number {
  return seg.type === 'polygon' ? computePolygonArea(seg) : computeRleArea(seg);
}

/** Total pixels an RLE claims to describe. A well-formed mask covers the frame exactly once. */
export function rleCoverage(seg: RLESegmentation): number {
  return seg.counts.reduce((acc, n) => acc + n, 0);
}

/**
 * Axis-aligned bounds of a mask, in COCO `[x, y, width, height]` form.
 *
 * For RLE the bounds are the whole frame: recovering a tight box would mean decoding every
 * run, and the export consumer treats the box as a hint rather than as ground truth.
 */
export function boundingBox(seg: Segmentation): BBox {
  if (seg.type === 'rle') {
    const [height, width] = seg.size;
    return [0, 0, width, height];
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of seg.polygons) {
    for (const ring of poly.rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!Number.isFinite(minX)) return [0, 0, 0, 0];
  return [minX, minY, maxX - minX, maxY - minY];
}

/** Every vertex of a polygon mask, flattened — used by the bounds check and by COCO export. */
export function vertices(seg: PolygonSegmentation): Ring {
  return seg.polygons.flatMap((poly) => poly.rings.flat());
}
