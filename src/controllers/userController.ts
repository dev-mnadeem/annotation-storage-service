import type { Request, Response } from 'express';
import type { z } from 'zod';
import { createUser } from '../store/users';
import type { CreateUserBody } from '../validation/requests';

/**
 * Issues an annotator and returns its API key. The key is generated here and stored only as a
 * digest, so this response is the one and only time it is readable — a lost key is reissued
 * by creating another user, not recovered.
 */
export async function createUserAccount(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof CreateUserBody>;
  const { user, apiKey } = await createUser(body);
  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    apiKey,
  });
}
