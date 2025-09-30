import { Router } from 'express';
import { createUserAccount } from '../controllers/userController';
import { requireAdmin } from '../middleware/apiKey';
import { validate } from '../middleware/validate';
import { CreateUserBody } from '../validation/requests';

const router = Router();

router.post('/', requireAdmin, validate('body', CreateUserBody), createUserAccount);

export default router;
