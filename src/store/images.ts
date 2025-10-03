import { Types } from 'mongoose';
import type { ImageStatus } from '../domain/imageLifecycle';
import { Image, type IImage } from '../models/Image';

export interface NewImage {
  uri: string;
  width: number;
  height: number;
  status?: ImageStatus;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

export function insertImages(projectId: Types.ObjectId, images: NewImage[]): Promise<IImage[]> {
  return Image.insertMany(
    images.map((img) => ({ ...img, project: projectId })),
    { ordered: true },
  );
}

export function findImage(id: string): Promise<IImage | null> {
  return Image.findById(id).exec();
}

export function setImageStatus(id: Types.ObjectId, status: ImageStatus): Promise<unknown> {
  return Image.updateOne({ _id: id }, { $set: { status } }).exec();
}

/**
 * Moves an image to `status` only if it is still in `from`. The compare-and-set is what keeps
 * two annotators finishing the same image from both believing they made the transition.
 */
export async function transitionImage(
  id: Types.ObjectId,
  from: ImageStatus,
  status: ImageStatus,
): Promise<boolean> {
  const result = await Image.updateOne({ _id: id, status: from }, { $set: { status } }).exec();
  return result.modifiedCount === 1;
}

export function listProjectImages(projectId: Types.ObjectId): Promise<IImage[]> {
  return Image.find({ project: projectId }).select('uri width height').lean().exec();
}
