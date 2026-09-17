import { describe, it, expect } from 'vitest';
import {
  EntityTypeCode,
  getEntityTypeCode,
  getEntityTypeFromCode,
  type EntityType,
} from '../src/types/taxonomy.js';
import { DEFAULT_SIMULATION_CONFIG } from '../src/types/config.js';

describe('Taxonomy & Ecological Configuration', () => {
  it('maps entity types to numeric codes bi-directionally', () => {
    const types: EntityType[] = ['plant', 'herbivore', 'carnivore', 'fungus'];

    for (const t of types) {
      const code = getEntityTypeCode(t);
      expect(Number.isInteger(code)).toBe(true);
      expect(getEntityTypeFromCode(code)).toBe(t);
    }
  });

  it('preserves trophic order for reproduction thresholds', () => {
    // Fundamental ecological law: Producers (plants) must reproduce before primary consumers
    // and primary consumers before apex predators to prevent immediate extinction cascades
    expect(DEFAULT_SIMULATION_CONFIG.plantReproductionThreshold).toBeLessThan(
      DEFAULT_SIMULATION_CONFIG.herbivoreReproductionThreshold
    );
    expect(DEFAULT_SIMULATION_CONFIG.herbivoreReproductionThreshold).toBeLessThan(
      DEFAULT_SIMULATION_CONFIG.carnivoreReproductionThreshold
    );
  });

  it('enforces sane population caps', () => {
    const { maxPlants, maxHerbivores, maxCarnivores, maxFungi, maxTotalEntities } =
      DEFAULT_SIMULATION_CONFIG;

    expect(maxPlants + maxHerbivores + maxCarnivores + maxFungi).toBe(maxTotalEntities);
    expect(maxPlants).toBeGreaterThan(maxHerbivores);
    expect(maxHerbivores).toBeGreaterThan(maxCarnivores);
  });
});

