import { vi } from 'vitest';
import type { EventLogger } from '../../../src/logging/event-logger';

export function createFakeEventLogger(): EventLogger {
  return {
    logBirth: vi.fn(async () => {}),
    logDeath: vi.fn(async () => {}),
    logReproduction: vi.fn(async () => {}),
    logMutation: vi.fn(async () => {}),
    logExtinction: vi.fn(async () => {}),
    logPopulationExplosion: vi.fn(async () => {}),
    logEcosystemCollapse: vi.fn(async () => {}),
    logDisaster: vi.fn(async () => {}),
    logUserIntervention: vi.fn(async () => {}),
    logEnvironmentChange: vi.fn(async () => {}),
    logCustom: vi.fn(async () => {}),
    logAmbientNarrative: vi.fn(async () => {})
  };
}
