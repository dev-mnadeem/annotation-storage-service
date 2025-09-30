import { Router } from 'express';
import { changeImageStatus, getImage, getImageMasks } from '../controllers/imageController';
import { validate } from '../middleware/validate';
import { IdParams, ImageActionBody } from '../validation/requests';

const router = Router();

router.get('/:id', validate('params', IdParams), getImage);
router.get('/:id/masks', validate('params', IdParams), getImageMasks);
router.patch(
  '/:id/status',
  validate('params', IdParams),
  validate('body', ImageActionBody),
  changeImageStatus,
);

export default router;
