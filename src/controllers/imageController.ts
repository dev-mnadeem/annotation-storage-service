import type { Request, Response } from 'express';
import type { z } from 'zod';
import { allowedActions, nextStatus, type ImageAction } from '../domain/imageLifecycle';
import { rankByArea } from '../domain/ranking';
import { ApiError } from '../lib/ApiError';
import { listImageAnnotations } from '../store/annotations';
import { findImage, insertImages, transitionImage } from '../store/images';
import { findProject } from '../store/projects';
import type { CreateImagesBody, ImageActionBody } from '../validation/requests';

export async function createImagesForProject(req: Request, res: Response): Promise<void> {
  const project = await findProject(req.params.projectId);
  if (!project) throw ApiError.notFound('Project');

  const { images } = req.body as z.infer<typeof CreateImagesBody>;
  const created = await insertImages(project._id as never, images);
  res.status(201).json({ inserted: created.length, images: created });
}

export async function getImage(req: Request, res: Response): Promise<void> {
  const image = await findImage(req.params.id);
  if (!image) throw ApiError.notFound('Image');
  res.json(image);
}

/**
 * Drives the image through its lifecycle. The client names an action, and the transition
 * table decides whether it is legal from the current status — so an unknown or out-of-order
 * action is a 409 rather than a silently accepted status write.
 */
export async function changeImageStatus(req: Request, res: Response): Promise<void> {
  const image = await findImage(req.params.id);
  if (!image) throw ApiError.notFound('Image');

  const { action } = req.body as z.infer<typeof ImageActionBody>;
  const target = nextStatus(image.status, action as ImageAction);
  if (!target) {
    throw ApiError.conflict(
      'illegal_transition',
      `cannot ${action} an image that is ${image.status}`,
      { from: image.status, allowed: allowedActions(image.status) },
    );
  }

  const moved = await transitionImage(image._id as never, image.status, target);
  if (!moved) {
    throw ApiError.conflict('status_changed', 'the image status changed during this request');
  }
  res.json({ id: image.id, from: image.status, to: target });
}

/**
 * Every mask on an image with its area rank, in one request. Ranking each mask separately
 * through `/annotations/:id/rank` costs one round trip per mask for the same answer.
 */
export async function getImageMasks(req: Request, res: Response): Promise<void> {
  const image = await findImage(req.params.id);
  if (!image) throw ApiError.notFound('Image');

  const annotations = await listImageAnnotations(image._id as never);
  const ranked = rankByArea(annotations.map((a) => ({ area: a.area, annotation: a })));

  res.json({
    imageId: image.id,
    total: annotations.length,
    masks: ranked.map(({ item, rank }) => ({
      id: item.annotation.id,
      label: item.annotation.label,
      area: item.area,
      rank,
      createdBy: item.annotation.createdBy,
    })),
  });
}
