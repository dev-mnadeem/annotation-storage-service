import { describe, expect, it } from 'vitest';
import { MASK_CHECKS, inspectMask } from '../../src/domain/mask/checks';
import type { ImageFrame, Segmentation } from '../../src/domain/mask/types';

const frame: ImageFrame = { width: 200, height: 100 };

const polygon = (ring: number[][]): Segmentation => ({
  type: 'polygon',
  polygons: [{ rings: [ring as [number, number][]] }],
});

const box = (w: number, h: number): Segmentation =>
  polygon([
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]);

function codes(seg: Segmentation, declared?: number): string[] {
  return inspectMask(seg, frame, declared).violations.map((v) => v.code);
}

describe('the check registry', () => {
  it('gives every check a unique id', () => {
    const ids = MASK_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('accepts a polygon that fits inside its image', () => {
    const verdict = inspectMask(box(50, 40), frame);
    expect(verdict.violations).toEqual([]);
    expect(verdict.area).toBe(2000);
  });
});

describe('polygon checks', () => {
  it('rejects a vertex outside the frame', () => {
    expect(codes(box(500, 40))).toContain('polygon_out_of_bounds');
  });

  it('rejects a ring that encloses no area', () => {
    expect(
      codes(
        polygon([
          [0, 0],
          [50, 0],
          [100, 0],
        ]),
      ),
    ).toContain('ring_degenerate');
  });

  it('reports an empty mask when holes cancel the outline', () => {
    const seg: Segmentation = {
      type: 'polygon',
      polygons: [
        {
          rings: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
          ],
        },
      ],
    };
    expect(codes(seg)).toContain('empty_mask');
  });

  it('accepts a mask that touches the image border exactly', () => {
    expect(codes(box(200, 100))).toEqual([]);
  });
});

describe('RLE checks', () => {
  const full = (): Segmentation => ({ type: 'rle', size: [100, 200], counts: [10_000, 10_000] });

  it('accepts runs that cover the frame exactly', () => {
    expect(codes(full())).toEqual([]);
  });

  it('rejects a size that disagrees with the image', () => {
    expect(codes({ type: 'rle', size: [50, 50], counts: [1250, 1250] })).toContain(
      'rle_size_mismatch',
    );
  });

  it('rejects a run list that does not cover the whole frame', () => {
    expect(codes({ type: 'rle', size: [100, 200], counts: [10, 20] })).toContain(
      'rle_counts_incomplete',
    );
  });

  it('skips polygon-only checks for an RLE mask', () => {
    expect(codes(full())).not.toContain('polygon_out_of_bounds');
  });
});

describe('area checks', () => {
  it('accepts a declared area that matches the computed one', () => {
    expect(codes(box(50, 40), 2000)).toEqual([]);
  });

  it('rejects a declared area that disagrees', () => {
    expect(codes(box(50, 40), 2001)).toContain('area_mismatch');
  });

  it('tolerates floating point drift within the epsilon', () => {
    expect(codes(box(50, 40), 2000 + 1e-9)).toEqual([]);
  });

  it('rejects a mask larger than its own image', () => {
    const seg: Segmentation = {
      type: 'polygon',
      polygons: [
        {
          rings: [
            [
              [0, 0],
              [200, 0],
              [200, 100],
              [0, 100],
            ] as [number, number][],
          ],
        },
        {
          rings: [
            [
              [0, 0],
              [200, 0],
              [200, 100],
              [0, 100],
            ] as [number, number][],
          ],
        },
      ],
    };
    expect(codes(seg)).toContain('area_exceeds_image');
  });
});

describe('violation reporting', () => {
  it('returns every violation rather than stopping at the first', () => {
    const found = codes({ type: 'rle', size: [7, 7], counts: [1] });
    expect(found).toContain('rle_size_mismatch');
    expect(found).toContain('rle_counts_incomplete');
  });

  it('names the check that produced each violation', () => {
    const { violations } = inspectMask(box(500, 40), frame);
    expect(violations[0].check).toBe('polygon-bounds');
  });
});
