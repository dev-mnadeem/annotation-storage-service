import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { SHUTDOWN_GRACE_SECONDS } from './config/constants';
import { env } from './config/env';

async function main(): Promise<void> {
  const config = env();

  // Connect before listening. A process that accepts traffic it cannot serve turns one
  // outage into a wall of 500s, and the health probe would have no chance to report it.
  await connectDb(config.MONGODB_URI);
  console.log('MongoDB connected');

  const server = http.createServer(createApp(config));
  server.listen(config.PORT, () => {
    console.log(`Segmentation API listening on http://localhost:${config.PORT}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received, draining`);
    const force = setTimeout(() => {
      console.error('Shutdown timed out, exiting');
      process.exit(1);
    }, SHUTDOWN_GRACE_SECONDS * 1000);
    force.unref();

    server.close(() => {
      void disconnectDb().then(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
