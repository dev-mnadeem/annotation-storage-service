import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

/** Each test file gets its own database on the shared server, so files cannot collide. */
const dbName = `seg_${Math.random().toString(36).slice(2, 10)}`;

beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) throw new Error('TEST_MONGODB_URI was not set by the global setup');
  await mongoose.connect(uri, { dbName });
  // Build the declared indexes so tests observe the same plans production would.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
