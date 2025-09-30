import { Router } from 'express';
import {
  createAnnotation,
  getAnnotation,
  getAnnotationRank,
  queryAnnotations,
} from '../controllers/annotationController';
import { validate } from '../middleware/validate';
import { AnnotationQuery, CreateAnnotationBody, IdParams } from '../validation/requests';

const router = Router();

router.post('/', validate('body', CreateAnnotationBody), createAnnotation);
router.get('/', validate('query', AnnotationQuery), queryAnnotations);
router.get('/:id', validate('params', IdParams), getAnnotation);
router.get('/:id/rank', validate('params', IdParams), getAnnotationRank);

export default router;
