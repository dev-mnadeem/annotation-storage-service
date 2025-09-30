import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';
import { ApiError } from '../lib/ApiError';
import type { UserRole } from '../models/User';
import { findByApiKey } from '../store/users';

/**
 * Who the current request is acting as. `id` is null only for the bootstrap admin, which is
 * an environment key rather than a user row — it exists so a fresh database can issue the
 * first annotator key without anyone editing the collection by hand.
 */
export interface Actor {
  id: Types.ObjectId | null;
  role: UserRole;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

export const API_KEY_HEADER = 'x-api-key';

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Resolves the key on every request but rejects nothing: `requireActor` decides which routes
 * need one. Keeping resolution and enforcement apart is what lets `/api/health` stay open
 * while everything under it is closed by default.
 */
export function resolveActor(adminKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const presented = req.header(API_KEY_HEADER);
    if (!presented) return next();

    if (constantTimeEquals(presented, adminKey)) {
      req.actor = { id: null, role: 'admin', name: 'bootstrap admin' };
      return next();
    }

    try {
      const user = await findByApiKey(presented);
      if (user) {
        req.actor = { id: user._id as Types.ObjectId, role: user.role, name: user.name };
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireActor(req: Request, _res: Response, next: NextFunction): void {
  if (!req.actor) return next(ApiError.unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.actor) return next(ApiError.unauthorized());
  if (req.actor.role !== 'admin') return next(ApiError.forbidden());
  next();
}

/** The identity written to `createdBy`. Read from the key, never from the request body. */
export function actorId(req: Request): Types.ObjectId | null {
  return req.actor?.id ?? null;
}
