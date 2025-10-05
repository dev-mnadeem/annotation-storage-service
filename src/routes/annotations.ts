import { Router } from 'express';
import {
  createAnnotation,
  getAnnotation,
  getAnnotationRank,
  queryAnnotations,
} from '../controllers/annotationController';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../middleware/validate';
import { AnnotationQuery, CreateAnnotationBody, IdParams } from '../validation/requests';

const router = Router();

router.post('/', validate('body', CreateAnnotationBody), asyncHandler(createAnnotation));
router.get('/', validate('query', AnnotationQuery), asyncHandler(queryAnnotations));
router.get('/:id', validate('params', IdParams), asyncHandler(getAnnotation));
router.get('/:id/rank', validate('params', IdParams), asyncHandler(getAnnotationRank));

export default router;
