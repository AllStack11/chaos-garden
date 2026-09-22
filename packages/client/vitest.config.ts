import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
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

