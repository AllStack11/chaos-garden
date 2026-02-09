import { vi } from 'vitest';
import type { ApplicationLogger } from '../../../src/logging/application-logger';

export function createFakeApplicationLogger(): ApplicationLogger {
  return {
    debug: vi.fn(async () => {}),
    info: vi.fn(async () => {}),
    warn: vi.fn(async () => {}),
    error: vi.fn(async () => {}),
    fatal: vi.fn(async () => {})
  };
}
