import mongoose, { Schema, type Document, type Types } from 'mongoose';

export const PROJECT_STATUSES = ['active', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface IProject extends Document {
  name: string;
  description?: string;
  status: ProjectStatus;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: PROJECT_STATUSES, default: 'active', index: true },
    /** Null when the project was created with the bootstrap admin key, which has no user row. */
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
