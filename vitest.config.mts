import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // One in-memory mongod is shared by every file, and each file gets its own database.
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
