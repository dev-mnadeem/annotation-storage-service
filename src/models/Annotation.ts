import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { Segmentation } from '../domain/mask/types';

export interface IAnnotation extends Document {
  project: Types.ObjectId;
  image: Types.ObjectId;
  label: string;
  segmentation: Segmentation;
  /** Always the server-computed pixel area. A client-supplied area is checked, never stored. */
  area: number;
  createdBy: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AnnotationSchema = new Schema<IAnnotation>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    image: { type: Schema.Types.ObjectId, ref: 'Image', required: true, index: true },
    label: { type: String, required: true, index: true },
    segmentation: { type: Schema.Types.Mixed, required: true },
    area: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

/** Area ranking within an image: both the per-mask rank counts and the ranked list seek here. */
AnnotationSchema.index({ image: 1, area: -1 });

/** Keyset pagination of a project's annotations, newest first. */
AnnotationSchema.index({ project: 1, _id: -1 });

/** Per-annotator counts on the project stats endpoint. */
AnnotationSchema.index({ project: 1, createdBy: 1 });

export const Annotation = mongoose.model<IAnnotation>('Annotation', AnnotationSchema);
