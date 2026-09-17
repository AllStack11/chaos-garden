import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/World.js';

describe('Determinism Invariant Test', () => {
  it('produces bit-identical entity states and render strides after 1000 ticks with identical seed', () => {
    const seed = 42;
    const ticks = 1000;

    const world1 = new World({ seed });
    world1.seedPrimordialEcosystem();

    for (let t = 0; t < ticks; t++) {
      world1.step();
    }

    const world2 = new World({ seed });
    world2.seedPrimordialEcosystem();

    for (let t = 0; t < ticks; t++) {
      world2.step();
    }

    // 1. Exact entity counts
    expect(world1.pool.denseCount).toBe(world2.pool.denseCount);
    expect(world1.getPopulationSummary()).toEqual(world2.getPopulationSummary());

    // 2. Exact component values for every active entity
    const count = world1.pool.denseCount;
    for (let i = 0; i < count; i++) {
      const idx1 = world1.pool.denseEntities[i];
      const idx2 = world2.pool.denseEntities[i];

      expect(world1.storage.positionsX[idx1]).toBe(world2.storage.positionsX[idx2]);
      expect(world1.storage.positionsY[idx1]).toBe(world2.storage.positionsY[idx2]);
      expect(world1.storage.velocitiesX[idx1]).toBe(world2.storage.velocitiesX[idx2]);
      expect(world1.storage.velocitiesY[idx1]).toBe(world2.storage.velocitiesY[idx2]);
      expect(world1.storage.energies[idx1]).toBe(world2.storage.energies[idx2]);
      expect(world1.storage.healths[idx1]).toBe(world2.storage.healths[idx2]);
      expect(world1.storage.typeCodes[idx1]).toBe(world2.storage.typeCodes[idx2]);
      expect(world1.storage.pigments[idx1]).toBe(world2.storage.pigments[idx2]);
    }

    // 3. Exact binary render buffer equality
    const frame1 = world1.getRenderFrame();
    const frame2 = world2.getRenderFrame();

    expect(frame1.entityCount).toBe(frame2.entityCount);
    const floatCount = frame1.entityCount * 8;
    for (let i = 0; i < floatCount; i++) {
      expect(frame1.buffer[i]).toBe(frame2.buffer[i]);
    }
  });
});

