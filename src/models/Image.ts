import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { IMAGE_STATUSES, type ImageStatus } from '../domain/imageLifecycle';

export interface IImage extends Document {
  project: Types.ObjectId;
  uri: string;
  width: number;
  height: number;
  status: ImageStatus;
  assignedTo?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IImage>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    uri: { type: String, required: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    status: { type: String, enum: IMAGE_STATUSES, default: 'unassigned', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

/** Backs the work-queue query "images in this project still waiting to be annotated". */
ImageSchema.index({ project: 1, status: 1 });

export const Image = mongoose.model<IImage>('Image', ImageSchema);
