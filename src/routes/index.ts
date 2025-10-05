import { Router } from 'express';
import annotationsRouter from './annotations';
import healthRouter from './health';
import imagesRouter from './images';
import projectsRouter from './projects';
import usersRouter from './users';
import { requireActor } from '../middleware/apiKey';

const router = Router();

/** Health is the only route that answers without a key — a probe has no identity. */
router.use('/health', healthRouter);

/**
 * Everything past this line is closed by default. Adding a router below it inherits
 * authentication rather than having to remember to ask for it.
 */
router.use(requireActor);
router.use('/users', usersRouter);
router.use('/projects', projectsRouter);
router.use('/images', imagesRouter);
router.use('/annotations', annotationsRouter);

export default router;
