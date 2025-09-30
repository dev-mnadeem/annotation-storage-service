import { Types } from 'mongoose';
import { Annotation } from '../models/Annotation';
import { Image } from '../models/Image';
import { Project, type IProject } from '../models/Project';

export function createProject(input: {
  name: string;
  description?: string;
  createdBy: Types.ObjectId | null;
}): Promise<IProject> {
  return Project.create(input);
}

export function findProject(id: string): Promise<IProject | null> {
  return Project.findById(id).exec();
}

export interface ProjectCounts {
  images: number;
  annotations: number;
  perAnnotator: { annotator: string | null; count: number }[];
  perLabel: { label: string; count: number }[];
}

/**
 * Four aggregate reads. Every grouping happens in the database, so the cost is bounded by the
 * number of distinct annotators and labels rather than by the number of annotations — a
 * project with a million masks and twelve labels returns twelve rows.
 */
export async function projectCounts(id: string): Promise<ProjectCounts> {
  const projectId = new Types.ObjectId(id);
  const [images, annotations, byAnnotator, byLabel] = await Promise.all([
    Image.countDocuments({ project: projectId }),
    Annotation.countDocuments({ project: projectId }),
    Annotation.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $match: { project: projectId } },
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Annotation.aggregate<{ _id: string; count: number }>([
      { $match: { project: projectId } },
      { $group: { _id: '$label', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    images,
    annotations,
    perAnnotator: byAnnotator.map((row) => ({
      annotator: row._id ? String(row._id) : null,
      count: row.count,
    })),
    perLabel: byLabel.map((row) => ({ label: row._id, count: row.count })),
  };
}
