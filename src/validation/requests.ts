import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants';
import { IMAGE_ACTIONS } from '../domain/imageLifecycle';
import { SegmentationZ } from '../domain/mask/schema';
import { IMAGE_STATUSES } from '../domain/imageLifecycle';
import { USER_ROLES } from '../models/User';

export const objectIdZ = z.string().refine(isValidObjectId, 'must be a 24-character ObjectId');

export const IdParams = z.object({ id: objectIdZ });
export const ProjectIdParams = z.object({ projectId: objectIdZ });

/**
 * Bodies are strict on purpose. The field this keeps out is `createdBy`: authorship comes
 * from the API key, and a request that tries to set it is a client bug worth surfacing
 * rather than a value worth ignoring. Free-form extras belong under `metadata`.
 */
export const CreateProjectBody = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  })
  .strict();

const NewImageZ = z
  .object({
    uri: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    status: z.enum(IMAGE_STATUSES).optional(),
    assignedTo: objectIdZ.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export const CreateImagesBody = z.object({ images: z.array(NewImageZ).min(1).max(1000) }).strict();

export const ImageActionBody = z.object({ action: z.enum(IMAGE_ACTIONS) }).strict();

export const CreateAnnotationBody = z
  .object({
    image: objectIdZ,
    project: objectIdZ.optional(),
    label: z.string().min(1).max(200),
    segmentation: SegmentationZ,
    /** Optional cross-check only. The stored area is always the one the server computes. */
    area: z.number().positive().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export const AnnotationQuery = z
  .object({
    label: z.string().min(1).optional(),
    annotator: objectIdZ.optional(),
    imageId: objectIdZ.optional(),
    projectId: objectIdZ.optional(),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export const CreateUserBody = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    role: z.enum(USER_ROLES).default('annotator'),
  })
  .strict();

export type CreateAnnotationInput = z.infer<typeof CreateAnnotationBody>;
export type AnnotationQueryInput = z.infer<typeof AnnotationQuery>;
