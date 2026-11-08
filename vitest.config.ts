import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/contracts/test/**/*.test.ts',
      'apps/api/test/unit/**/*.test.ts',
      'apps/web/test/unit/**/*.test.ts',
    ],
    testTimeout: 10000,
  },
});
