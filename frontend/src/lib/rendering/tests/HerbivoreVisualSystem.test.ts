import { describe, expect, it } from 'vitest';
import { generateHerbivoreVisual } from '../HerbivoreVisualSystem.ts';

describe('HerbivoreVisualSystem - Centipede', () => {
  it('correctly classifies centipede names', () => {
    const centipedeEntity = {
      id: 'test-id',
      name: 'Centipede-stride',
      species: 'Herbivore',
      health: 100,
      energy: 100,
      position: { x: 0, y: 0 },
      traits: {
        reproductionRate: 0.1,
        movementSpeed: 1.0,
        metabolismEfficiency: 1.0,
        perceptionRadius: 100
      }
    };

    const visual = generateHerbivoreVisual(centipedeEntity as any);
    expect(visual.creatureType).toBe('centipede');
    expect(visual.legCount).toBeGreaterThanOrEqual(16);
    expect(visual.hasWings).toBe(false);
  });

  it('correctly classifies crawler names as centipede', () => {
    const crawlerEntity = {
      id: 'test-id-2',
      name: 'Crawler-dash',
      species: 'Herbivore',
      health: 100,
      energy: 100,
      position: { x: 0, y: 0 },
      traits: {
        reproductionRate: 0.1,
        movementSpeed: 1.0,
        metabolismEfficiency: 1.0,
        perceptionRadius: 100
      }
    };

    const visual = generateHerbivoreVisual(crawlerEntity as any);
    expect(visual.creatureType).toBe('centipede');
  });
});
