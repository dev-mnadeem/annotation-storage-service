import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  computePolygonArea,
  computeRleArea,
  computeSegmentationArea,
  ringArea,
  rleCoverage,
} from '../../src/domain/mask/area';
import type { PolygonSegmentation, RLESegmentation } from '../../src/domain/mask/types';

const square = (side: number): number[][] => [
  [0, 0],
  [side, 0],
  [side, side],
  [0, side],
];

describe('ringArea', () => {
  it('measures a square by the shoelace formula', () => {
    expect(ringArea(square(10) as [number, number][])).toBe(100);
  });

  it('ignores winding order', () => {
    const clockwise = [...square(10)].reverse() as [number, number][];
    expect(ringArea(clockwise)).toBe(100);
  });

  it('returns zero for a ring with fewer than three vertices', () => {
    expect(
      ringArea([
        [0, 0],
        [5, 5],
      ]),
    ).toBe(0);
  });

  it('returns zero for three collinear points', () => {
    expect(
      ringArea([
        [0, 0],
        [5, 0],
        [10, 0],
      ]),
    ).toBe(0);
  });
});

describe('computePolygonArea', () => {
  it('subtracts holes from the outer ring', () => {
    const seg: PolygonSegmentation = {
      type: 'polygon',
      polygons: [{ rings: [square(10), square(4)] as [number, number][][] }],
    };
    expect(computePolygonArea(seg)).toBe(100 - 16);
  });

  it('floors a polygon whose holes exceed its outline at zero', () => {
    const seg: PolygonSegmentation = {
      type: 'polygon',
      polygons: [{ rings: [square(4), square(10)] as [number, number][][] }],
    };
    expect(computePolygonArea(seg)).toBe(0);
  });

  it('sums independent polygons', () => {
    const seg: PolygonSegmentation = {
      type: 'polygon',
      polygons: [
        { rings: [square(10) as [number, number][]] },
        { rings: [square(5) as [number, number][]] },
      ],
    };
    expect(computePolygonArea(seg)).toBe(125);
  });
});

describe('computeRleArea', () => {
  it('sums the odd-indexed runs, because counts start with background', () => {
    const seg: RLESegmentation = { type: 'rle', size: [4, 4], counts: [3, 5, 2, 6] };
    expect(computeRleArea(seg)).toBe(11);
  });

  it('reports zero foreground for a single background run', () => {
    expect(computeRleArea({ type: 'rle', size: [2, 2], counts: [4] })).toBe(0);
  });
});

describe('rleCoverage', () => {
  it('totals every run regardless of polarity', () => {
    expect(rleCoverage({ type: 'rle', size: [4, 4], counts: [3, 5, 2, 6] })).toBe(16);
  });
});

describe('boundingBox', () => {
  it('bounds a polygon in x, y, width, height order', () => {
    const seg: PolygonSegmentation = {
      type: 'polygon',
      polygons: [
        {
          rings: [
            [
              [10, 20],
              [40, 20],
              [40, 60],
            ],
          ],
        },
      ],
    };
    expect(boundingBox(seg)).toEqual([10, 20, 30, 40]);
  });

  it('uses the whole frame for an RLE mask', () => {
    expect(boundingBox({ type: 'rle', size: [100, 200], counts: [1] })).toEqual([0, 0, 200, 100]);
  });
});

describe('computeSegmentationArea', () => {
  it('dispatches on the segmentation type', () => {
    expect(
      computeSegmentationArea({
        type: 'polygon',
        polygons: [{ rings: [square(3) as [number, number][]] }],
      }),
    ).toBe(9);
    expect(computeSegmentationArea({ type: 'rle', size: [2, 2], counts: [1, 3] })).toBe(3);
  });
});
