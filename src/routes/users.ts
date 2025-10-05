import { Router } from 'express';
import { createUserAccount } from '../controllers/userController';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAdmin } from '../middleware/apiKey';
import { validate } from '../middleware/validate';
import { CreateUserBody } from '../validation/requests';

const router = Router();

router.post('/', requireAdmin, validate('body', CreateUserBody), asyncHandler(createUserAccount));

export default router;
