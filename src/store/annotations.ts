import { Types, type FilterQuery } from 'mongoose';
import { DEFAULT_PAGE_SIZE } from '../config/constants';
import type { Segmentation } from '../domain/mask/types';
import { Annotation, type IAnnotation } from '../models/Annotation';

export interface AnnotationFilter {
  label?: string;
  annotator?: string;
  imageId?: string;
  projectId?: string;
}

function toQuery(filter: AnnotationFilter): FilterQuery<IAnnotation> {
  const query: FilterQuery<IAnnotation> = {};
  if (filter.label) query.label = filter.label;
  if (filter.annotator) query.createdBy = new Types.ObjectId(filter.annotator);
  if (filter.imageId) query.image = new Types.ObjectId(filter.imageId);
  if (filter.projectId) query.project = new Types.ObjectId(filter.projectId);
  return query;
}

export function createAnnotation(input: {
  project: Types.ObjectId;
  image: Types.ObjectId;
  label: string;
  segmentation: Segmentation;
  area: number;
  createdBy: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
}): Promise<IAnnotation> {
  return Annotation.create(input);
}

export function findAnnotation(id: string): Promise<IAnnotation | null> {
  return Annotation.findById(id).exec();
}

/**
 * One page of a keyset scan. `limit + 1` documents are requested so the caller learns whether
 * a further page exists without a second count query — the `total` a client would get from
 * `countDocuments` costs a full index scan on every page and almost nothing consumes it.
 */
export async function pageAnnotations(
  filter: AnnotationFilter,
  limit: number = DEFAULT_PAGE_SIZE,
  after?: string,
): Promise<{ items: IAnnotation[]; hasMore: boolean }> {
  const query = toQuery(filter);
  if (after) query._id = { $lt: new Types.ObjectId(after) };
  const rows = await Annotation.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .exec();
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Two counted index seeks on `{ image: 1, area: -1 }`; neither loads an annotation document. */
export async function areaRank(
  imageId: Types.ObjectId,
  area: number,
): Promise<{ rank: number; total: number }> {
  const [larger, total] = await Promise.all([
    Annotation.countDocuments({ image: imageId, area: { $gt: area } }),
    Annotation.countDocuments({ image: imageId }),
  ]);
  return { rank: larger + 1, total };
}

/** Every mask on one image, largest first, so a client can rank the whole image in one call. */
export function listImageAnnotations(imageId: Types.ObjectId): Promise<IAnnotation[]> {
  return Annotation.find({ image: imageId }).sort({ area: -1 }).exec();
}

export function listProjectAnnotations(projectId: Types.ObjectId): Promise<IAnnotation[]> {
  return Annotation.find({ project: projectId })
    .select('image label segmentation area')
    .lean<IAnnotation[]>()
    .exec();
}
