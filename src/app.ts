import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { JSON_BODY_LIMIT } from './config/constants';
import type { Env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { resolveActor } from './middleware/apiKey';
import apiRouter from './routes';

/**
 * Built from an explicit `Env` rather than reading `process.env`, so a test can stand up an
 * app with its own admin key and port without touching the process environment.
 */
export function createApp(env: Env): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  if (env.REQUEST_LOG !== 'off') app.use(morgan(env.REQUEST_LOG));

  app.use(resolveActor(env.ADMIN_API_KEY));
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
