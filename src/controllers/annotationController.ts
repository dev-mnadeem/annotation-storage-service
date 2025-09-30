import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { inspectMask } from '../domain/mask/checks';
import { nextStatus } from '../domain/imageLifecycle';
import { ApiError } from '../lib/ApiError';
import { decodeCursor, encodeCursor } from '../lib/cursor';
import { actorId } from '../middleware/apiKey';
import {
  areaRank,
  createAnnotation as insertAnnotation,
  findAnnotation,
  pageAnnotations,
} from '../store/annotations';
import { findImage, transitionImage } from '../store/images';
import type { AnnotationQueryInput, CreateAnnotationInput } from '../validation/requests';

/**
 * Storing a mask is three decisions in order: which image it belongs to, whether the geometry
 * is legal for that image, and what its area is. Only the first needs the database, and only
 * the third is ever written from the client's numbers — and it isn't.
 */
export async function createAnnotation(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateAnnotationInput;

  const image = await findImage(body.image);
  if (!image) throw ApiError.notFound('Image');

  // The project is derived from the image. A client may state it, but only to be checked.
  if (body.project && body.project !== String(image.project)) {
    throw ApiError.badRequest(
      'project_mismatch',
      `image ${body.image} belongs to project ${String(image.project)}`,
    );
  }

  const verdict = inspectMask(
    body.segmentation,
    { width: image.width, height: image.height },
    body.area,
  );
  if (verdict.violations.length > 0) {
    throw ApiError.badRequest(
      'mask_rejected',
      'the mask is not valid for this image',
      verdict.violations,
    );
  }

  const annotation = await insertAnnotation({
    project: image.project,
    image: image._id as Types.ObjectId,
    label: body.label,
    segmentation: body.segmentation,
    area: verdict.area,
    createdBy: actorId(req),
    metadata: body.metadata,
  });

  // Accepting a mask advances the image, but only along an edge the lifecycle allows.
  const target = nextStatus(image.status, 'annotate');
  if (target && target !== image.status) {
    await transitionImage(image._id as Types.ObjectId, image.status, target);
  }

  res.status(201).json(annotation);
}

export async function getAnnotation(req: Request, res: Response): Promise<void> {
  const annotation = await findAnnotation(req.params.id);
  if (!annotation) throw ApiError.notFound('Annotation');
  res.json(annotation);
}

export async function queryAnnotations(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as AnnotationQueryInput;
  const after = query.cursor ? decodeCursor(query.cursor) : undefined;

  const { items, hasMore } = await pageAnnotations(query, query.limit, after);
  const last = items[items.length - 1];

  res.json({
    limit: query.limit,
    items,
    nextCursor: hasMore && last ? encodeCursor(String(last._id)) : null,
  });
}

export async function getAnnotationRank(req: Request, res: Response): Promise<void> {
  const annotation = await findAnnotation(req.params.id);
  if (!annotation) throw ApiError.notFound('Annotation');

  const { rank, total } = await areaRank(annotation.image, annotation.area);
  res.json({
    annotationId: annotation.id,
    imageId: String(annotation.image),
    area: annotation.area,
    rank,
    total,
  });
}
