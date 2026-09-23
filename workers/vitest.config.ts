import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./tests/helpers/setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--max-old-space-size=4096', '--max-semi-space-size=128'],
      },
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
        statements: 60,
      },
    },
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
