import { beforeEach, describe, expect, it } from 'vitest';
import { clearVisualGenomeCache, getVisualGenome } from './VisualGenome.ts';

describe('rendering/VisualGenome', () => {
  beforeEach(() => {
    clearVisualGenomeCache();
  });

  it('returns the cached genome for the same entity id', () => {
    const first = getVisualGenome({
      id: 'entity-1',
      species: 'fern',
      type: 'plant',
      traits: {
        reproductionRate: 0.5,
        metabolismEfficiency: 1.1,
      },
    });

    const second = getVisualGenome({
      id: 'entity-1',
      species: 'different-species',
      type: 'carnivore',
      traits: {
        reproductionRate: 0.9,
        movementSpeed: 2.2,
      },
    });

    expect(second).toBe(first);
  });

  it('normalizes trait key order for deterministic seed generation', () => {
    const input = {
      id: 'entity-2',
      species: 'moss',
      type: 'plant' as const,
    };

    const first = getVisualGenome({
      ...input,
      traits: {
        metabolismEfficiency: 0.8,
        reproductionRate: 0.4,
        perceptionRadius: 12,
      },
    });

    clearVisualGenomeCache();

    const second = getVisualGenome({
      ...input,
      traits: {
        perceptionRadius: 12,
        reproductionRate: 0.4,
        metabolismEfficiency: 0.8,
      },
    });

    expect(second).toEqual(first);
  });

  it('regenerates genome values after cache clear and keeps values in expected ranges', () => {
    const first = getVisualGenome({
      id: 'entity-3',
      species: 'vine',
      type: 'plant',
      traits: {
        reproductionRate: 0.6,
        metabolismEfficiency: 1.2,
      },
    });

    clearVisualGenomeCache();

    const second = getVisualGenome({
      id: 'entity-3',
      species: 'vine',
      type: 'plant',
      traits: {
        reproductionRate: 0.7,
        metabolismEfficiency: 1.2,
      },
    });

    expect(second).not.toBe(first);
    expect(second.seed).not.toBe(first.seed);
    expect(second.plant.branchDepth).toBeGreaterThanOrEqual(2);
    expect(second.plant.branchDepth).toBeLessThan(6);
    expect(second.herbivore.patternMapSeed).toBeGreaterThanOrEqual(1);
    expect(second.herbivore.patternMapSeed).toBeLessThan(99999);
  });
});
