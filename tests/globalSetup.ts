import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Tests run against a real mongod, downloaded and started in memory, so index definitions,
 * aggregation pipelines and the compare-and-set status update are exercised for real rather
 * than against a stub that would agree with whatever the code does.
 */
let mongod: MongoMemoryServer;

export async function setup(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  process.env.TEST_MONGODB_URI = mongod.getUri();
}

export async function teardown(): Promise<void> {
  await mongod?.stop();
}
