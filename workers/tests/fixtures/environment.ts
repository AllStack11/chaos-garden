import type { Environment } from '@chaos-garden/shared';

export function buildEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    temperature: 20,
    sunlight: 0.5,
    moisture: 0.5,
    tick: 1,
    ...overrides
  };
}
