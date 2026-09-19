import { describe, it, expect } from 'vitest';
import { GardenState } from '../../src/state/gardenState.svelte.js';
import type { TelemetryPulse } from '../../src/worker/types.js';

describe('GardenState Svelte 5 Runes Tests', () => {
  it('computes derived population ratios correctly', () => {
    const state = new GardenState();

    state.updateFromTelemetry({
      type: 'TELEMETRY_PULSE',
      tick: 100,
      tps: 60,
      populations: {
        plants: 50,
        herbivores: 30,
        carnivores: 10,
        fungi: 10,
        totalLiving: 100,
        totalBiomass: 5000,
      },
    });

    expect(state.tick).toBe(100);
    expect(state.tps).toBe(60);
    expect(state.plantRatio).toBeCloseTo(0.5);
    expect(state.herbivoreRatio).toBeCloseTo(0.3);
    expect(state.carnivoreRatio).toBeCloseTo(0.1);
    expect(state.fungusRatio).toBeCloseTo(0.1);
  });

  it('manages pause and speed multiplier states', () => {
    const state = new GardenState();
    expect(state.isPaused).toBe(false);

    state.togglePause();
    expect(state.speedMultiplier).toBe(0);
    expect(state.isPaused).toBe(true);

    state.togglePause();
    expect(state.speedMultiplier).toBe(1.0);
    expect(state.isPaused).toBe(false);

    state.setSpeed(5.0);
    expect(state.speedMultiplier).toBe(5.0);
    expect(state.isPaused).toBe(false);
  });

  it('handles zero totalLiving without NaN division', () => {
    const state = new GardenState();
    state.populations.totalLiving = 0;
    expect(state.plantRatio).toBe(0);
    expect(state.herbivoreRatio).toBe(0);
  });
});

