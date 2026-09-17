import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    poolOptions: {
      threads: {
        execArgv: ['--expose-gc'],
      },
      forks: {
        execArgv: ['--expose-gc'],
      },
    },
  },
});
