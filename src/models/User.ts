import mongoose, { Schema, type Document } from 'mongoose';

export const USER_ROLES = ['annotator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  role: UserRole;
  /** SHA-256 of the issued API key. The key itself is shown once, at creation, and never stored. */
  apiKeyHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: USER_ROLES, default: 'annotator' },
    apiKeyHash: { type: String, required: true, unique: true, index: true, select: false },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>('User', UserSchema);
