import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('Trophic Ordering Invariant Test', () => {
  it('strictly maintains plant (55) < herbivore (65) < carnivore (75) thresholds across 500 ticks', () => {
    const world = new World({ seed: 31415 });
    world.seedPrimordialEcosystem();

    for (let t = 0; t < 500; t++) {
      world.step();

      const count = world.pool.denseCount;
      const dense = world.pool.denseEntities;

      for (let i = 0; i < count; i++) {
        const idx = dense[i];
        const type = world.storage.typeCodes[idx];
        const threshold = world.storage.reproductionThresholds[idx];

        if (type === EntityTypeCode.PLANT) {
          expect(threshold).toBeLessThan(65);
        } else if (type === EntityTypeCode.HERBIVORE) {
          expect(threshold).toBeGreaterThan(55);
          expect(threshold).toBeLessThan(75);
        } else if (type === EntityTypeCode.CARNIVORE) {
          expect(threshold).toBeGreaterThan(65);
        }
      }
    }
  });
});

