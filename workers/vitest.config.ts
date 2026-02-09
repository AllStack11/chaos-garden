import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./tests/helpers/setup.ts']
  },
  coverage: {
    provider: 'v8',
    include: ['src/simulation/**/*.ts'],
    exclude: ['src/**/*.d.ts', 'src/index.ts', 'src/types/**/*.ts'],
    reporter: ['text', 'html'],
    thresholds: {
      lines: 60,
      branches: 50,
      functions: 60,
      statements: 60
    }
  }
});
