import { Router } from 'express';
import {
  createProject,
  exportProject,
  getProject,
  getProjectStats,
} from '../controllers/projectController';
import { createImagesForProject } from '../controllers/imageController';
import { requireAdmin } from '../middleware/apiKey';
import { validate } from '../middleware/validate';
import {
  CreateImagesBody,
  CreateProjectBody,
  IdParams,
  ProjectIdParams,
} from '../validation/requests';

const router = Router();

router.post('/', requireAdmin, validate('body', CreateProjectBody), createProject);
router.get('/:id', validate('params', IdParams), getProject);
router.get('/:id/stats', validate('params', IdParams), getProjectStats);
router.get('/:id/export', validate('params', IdParams), exportProject);
router.post(
  '/:projectId/images',
  requireAdmin,
  validate('params', ProjectIdParams),
  validate('body', CreateImagesBody),
  createImagesForProject,
);

export default router;
