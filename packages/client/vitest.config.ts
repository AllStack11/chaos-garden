import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
    fileParallelism: false,
    poolOptions: {
      threads: {
        execArgv: ['--expose-gc'],
      },
      forks: {
        execArgv: ['--expose-gc'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.svelte'],
      exclude: [
        'src/main.ts',
        'src/worker/types.ts',
        'src/worker/simulationWorker.ts',
      ],
    },
  },
});

