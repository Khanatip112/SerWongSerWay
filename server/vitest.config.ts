import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    // Database-backed suites clean shared tables; running files serially keeps them isolated.
    fileParallelism: false,
  },
});
