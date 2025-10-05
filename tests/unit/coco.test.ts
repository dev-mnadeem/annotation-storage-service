import { describe, expect, it } from 'vitest';
import { buildCategories, buildCocoDataset } from '../../src/domain/coco';
import type { Segmentation } from '../../src/domain/mask/types';

const square: Segmentation = {
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
      ],
    },
  ],
};

const rle: Segmentation = { type: 'rle', size: [10, 20], counts: [100, 100] };

describe('buildCategories', () => {
  it('numbers categories from one, since COCO reserves no id zero', () => {
    expect(buildCategories(['car', 'bus'])).toEqual([
      { id: 1, name: 'bus', supercategory: 'object' },
      { id: 2, name: 'car', supercategory: 'object' },
    ]);
  });

  it('deduplicates repeated labels', () => {
    expect(buildCategories(['car', 'car', 'car']).length).toBe(1);
  });

  it('is stable across calls with the labels in a different order', () => {
    expect(buildCategories(['b', 'a'])).toEqual(buildCategories(['a', 'b']));
  });
});

describe('buildCocoDataset', () => {
  const dataset = buildCocoDataset({
    projectName: 'Road signs',
    projectId: 'p1',
    images: [{ id: 'i1', uri: 's3://bucket/one.png', width: 20, height: 10 }],
    annotations: [
      { id: 'a1', image: 'i1', label: 'sign', segmentation: square, area: 100 },
      { id: 'a2', image: 'i1', label: 'road', segmentation: rle, area: 100 },
    ],
  });

  it('maps images to the COCO file_name field', () => {
    expect(dataset.images).toEqual([
      { id: 'i1', file_name: 's3://bucket/one.png', width: 20, height: 10 },
    ]);
  });

  it('links every annotation to a category that exists', () => {
    const ids = new Set(dataset.categories.map((c) => c.id));
    for (const ann of dataset.annotations) expect(ids.has(ann.category_id)).toBe(true);
  });

  it('marks RLE masks as crowd regions and polygons as instances', () => {
    expect(dataset.annotations.find((a) => a.id === 'a2')?.iscrowd).toBe(1);
    expect(dataset.annotations.find((a) => a.id === 'a1')?.iscrowd).toBe(0);
  });

  it('recomputes area from the geometry rather than copying the stored value', () => {
    const drifted = buildCocoDataset({
      projectName: 'p',
      projectId: 'p1',
      images: [],
      annotations: [{ id: 'a1', image: 'i1', label: 'sign', segmentation: square, area: 999_999 }],
    });
    expect(drifted.annotations[0].area).toBe(100);
  });

  it('records how many annotations it exported', () => {
    expect(dataset.info.exported_count).toBe(2);
  });
});
