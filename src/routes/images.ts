import { Router } from 'express';
import { changeImageStatus, getImage, getImageMasks } from '../controllers/imageController';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../middleware/validate';
import { IdParams, ImageActionBody } from '../validation/requests';

const router = Router();

router.get('/:id', validate('params', IdParams), asyncHandler(getImage));
router.get('/:id/masks', validate('params', IdParams), asyncHandler(getImageMasks));
router.patch(
  '/:id/status',
  validate('params', IdParams),
  validate('body', ImageActionBody),
  asyncHandler(changeImageStatus),
);

export default router;
