import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/api/test/integration/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 20000,
    testTimeout: 10000,
  },
});
