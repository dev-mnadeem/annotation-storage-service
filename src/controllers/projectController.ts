import type { Request, Response } from 'express';
import { buildCocoDataset } from '../domain/coco';
import { ApiError } from '../lib/ApiError';
import { actorId } from '../middleware/apiKey';
import { listProjectAnnotations } from '../store/annotations';
import { listProjectImages } from '../store/images';
import { createProject as insertProject, findProject, projectCounts } from '../store/projects';
import { findManyByIds } from '../store/users';
import type { CreateProjectBody } from '../validation/requests';
import type { z } from 'zod';

export async function createProject(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof CreateProjectBody>;
  const project = await insertProject({ ...body, createdBy: actorId(req) });
  res.status(201).json(project);
}

export async function getProject(req: Request, res: Response): Promise<void> {
  const project = await findProject(req.params.id);
  if (!project) throw ApiError.notFound('Project');
  res.json(project);
}

export async function getProjectStats(req: Request, res: Response): Promise<void> {
  const project = await findProject(req.params.id);
  if (!project) throw ApiError.notFound('Project');

  const counts = await projectCounts(req.params.id);
  const users = await findManyByIds(
    counts.perAnnotator.map((row) => row.annotator).filter(Boolean),
  );
  const byId = new Map(users.map((u) => [String(u._id), { name: u.name, email: u.email }]));

  res.json({
    projectId: project.id,
    images: counts.images,
    annotations: counts.annotations,
    perLabel: counts.perLabel,
    perAnnotator: counts.perAnnotator.map((row) => ({
      annotator: row.annotator,
      count: row.count,
      user: row.annotator ? (byId.get(row.annotator) ?? null) : null,
    })),
  });
}

/**
 * Dumps the whole project as a COCO instance-segmentation document. This is the one
 * deliberately unbounded read in the service: an export is a whole-project operation by
 * definition, and splitting it across pages would produce a file no consumer can parse.
 */
export async function exportProject(req: Request, res: Response): Promise<void> {
  const project = await findProject(req.params.id);
  if (!project) throw ApiError.notFound('Project');

  const [images, annotations] = await Promise.all([
    listProjectImages(project._id as never),
    listProjectAnnotations(project._id as never),
  ]);

  const dataset = buildCocoDataset({
    projectName: project.name,
    projectId: project.id,
    images: images.map((img) => ({
      id: String(img._id),
      uri: img.uri,
      width: img.width,
      height: img.height,
    })),
    annotations: annotations.map((ann) => ({
      id: String(ann._id),
      image: String(ann.image),
      label: ann.label,
      segmentation: ann.segmentation,
      area: ann.area,
    })),
  });

  res.setHeader('Content-Disposition', `attachment; filename="coco-${project.id}.json"`);
  res.json(dataset);
}
