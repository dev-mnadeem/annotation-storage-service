import { Router } from 'express';
import { dbStateName, isDbConnected } from '../config/db';

const router = Router();

/**
 * Reports 503 while the database is unreachable. The process stays up so the container can be
 * restarted by the orchestrator rather than crash-looping, but it must not claim readiness:
 * every route below /api needs Mongo, so a 200 here with a dead connection is a lie.
 */
router.get('/', (_req, res) => {
  const connected = isDbConnected();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    db: { state: dbStateName() },
  });
});

export default router;
