import { describe, expect, it } from 'vitest';
import { DEFAULT_SIMULATION_CONFIG } from './types';

describe('shared/DEFAULT_SIMULATION_CONFIG', () => {
  it('uses expected core simulation defaults', () => {
    expect(DEFAULT_SIMULATION_CONFIG.gardenWidth).toBe(800);
    expect(DEFAULT_SIMULATION_CONFIG.gardenHeight).toBe(600);
    expect(DEFAULT_SIMULATION_CONFIG.basePhotosynthesisRate).toBe(2.3);
  });

  it('keeps reproduction thresholds ordered by trophic level', () => {
    expect(DEFAULT_SIMULATION_CONFIG.plantReproductionThreshold).toBeLessThan(
      DEFAULT_SIMULATION_CONFIG.herbivoreReproductionThreshold
    );
    expect(DEFAULT_SIMULATION_CONFIG.herbivoreReproductionThreshold).toBeLessThan(
      DEFAULT_SIMULATION_CONFIG.carnivoreReproductionThreshold
    );
  });

  it('enforces sane entity-cap constraints', () => {
    const totalSpeciesCaps =
      DEFAULT_SIMULATION_CONFIG.maxPlants +
      DEFAULT_SIMULATION_CONFIG.maxHerbivores +
      DEFAULT_SIMULATION_CONFIG.maxCarnivores;

    expect(DEFAULT_SIMULATION_CONFIG.maxTotalEntities).toBeGreaterThanOrEqual(totalSpeciesCaps);
    expect(DEFAULT_SIMULATION_CONFIG.maxPlants).toBeGreaterThan(0);
    expect(DEFAULT_SIMULATION_CONFIG.maxHerbivores).toBeGreaterThan(0);
    expect(DEFAULT_SIMULATION_CONFIG.maxCarnivores).toBeGreaterThan(0);
  });
});
