import { Router } from 'express';
import {
  createProject,
  exportProject,
  getProject,
  getProjectStats,
} from '../controllers/projectController';
import { createImagesForProject } from '../controllers/imageController';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAdmin } from '../middleware/apiKey';
import { validate } from '../middleware/validate';
import {
  CreateImagesBody,
  CreateProjectBody,
  IdParams,
  ProjectIdParams,
} from '../validation/requests';

const router = Router();

router.post('/', requireAdmin, validate('body', CreateProjectBody), asyncHandler(createProject));
router.get('/:id', validate('params', IdParams), asyncHandler(getProject));
router.get('/:id/stats', validate('params', IdParams), asyncHandler(getProjectStats));
router.get('/:id/export', validate('params', IdParams), asyncHandler(exportProject));
router.post(
  '/:projectId/images',
  requireAdmin,
  validate('params', ProjectIdParams),
  validate('body', CreateImagesBody),
  asyncHandler(createImagesForProject),
);

export default router;
