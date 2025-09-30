import { boundingBox, computeSegmentationArea } from './mask/area';
import type { BBox, Segmentation } from './mask/types';

/**
 * A minimal COCO instance-segmentation document. Training pipelines read this shape directly,
 * so the export exists to make a project's masks usable outside this service without anyone
 * writing a conversion script against the Mongo documents.
 */
export interface CocoImage {
  id: string;
  file_name: string;
  width: number;
  height: number;
}

export interface CocoCategory {
  id: number;
  name: string;
  supercategory: string;
}

export interface CocoAnnotation {
  id: string;
  image_id: string;
  category_id: number;
  segmentation: Segmentation;
  area: number;
  bbox: BBox;
  iscrowd: 0 | 1;
}

export interface CocoDataset {
  info: { description: string; project: string; exported_count: number };
  images: CocoImage[];
  categories: CocoCategory[];
  annotations: CocoAnnotation[];
}

export interface ExportImage {
  id: string;
  uri: string;
  width: number;
  height: number;
}

export interface ExportAnnotation {
  id: string;
  image: string;
  label: string;
  segmentation: Segmentation;
  area: number;
}

/**
 * Categories are derived from the labels actually present and numbered from 1, because COCO
 * reserves no category 0 and consumers index into the list. Sorting the labels keeps the
 * numbering stable across two exports of an unchanged project.
 */
export function buildCategories(labels: string[]): CocoCategory[] {
  return [...new Set(labels)]
    .sort()
    .map((name, index) => ({ id: index + 1, name, supercategory: 'object' }));
}

export function buildCocoDataset(input: {
  projectName: string;
  projectId: string;
  images: ExportImage[];
  annotations: ExportAnnotation[];
}): CocoDataset {
  const categories = buildCategories(input.annotations.map((a) => a.label));
  const categoryId = new Map(categories.map((c) => [c.name, c.id]));

  return {
    info: {
      description: input.projectName,
      project: input.projectId,
      exported_count: input.annotations.length,
    },
    images: input.images.map((img) => ({
      id: img.id,
      file_name: img.uri,
      width: img.width,
      height: img.height,
    })),
    categories,
    annotations: input.annotations.map((ann) => ({
      id: ann.id,
      image_id: ann.image,
      category_id: categoryId.get(ann.label) as number,
      segmentation: ann.segmentation,
      // Recomputed rather than trusted, so an export never disagrees with the geometry.
      area: computeSegmentationArea(ann.segmentation),
      bbox: boundingBox(ann.segmentation),
      iscrowd: ann.segmentation.type === 'rle' ? 1 : 0,
    })),
  };
}
