import { describe, it, expect } from 'vitest';
import { GeneticsSystem } from '../../src/systems/GeneticsSystem.js';
import { EntityPool } from '../../src/ecs/EntityPool.js';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { EntityTypeCode, createMulberry32, DEFAULT_SIMULATION_CONFIG } from '@chaos-garden/shared';

describe('GeneticsSystem (Trophic Invariants & Reproduction)', () => {
  it('triggers reproduction when entity exceeds kingdom threshold and splits energy 50%', () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const prng = createMulberry32(12345);
    const genetics = new GeneticsSystem(DEFAULT_SIMULATION_CONFIG);

    const parent = pool.allocate();
    storage.initEntity(parent, {
      idHash: 100,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 300,
      y: 300,
      size: 10,
      pigment: 150,
      energy: 80, // > 65 herbivore threshold
      health: 100,
      generation: 1,
      reproductionThreshold: 65,
    });

    genetics.update(1, pool, storage, prng);

    // Parent should have reproduced -> denseCount becomes 2
    expect(pool.denseCount).toBe(2);

    // Parent energy split to 50%
    expect(storage.energies[parent]).toBeCloseTo(40);

    // Child is in denseEntities[1]
    const child = pool.denseEntities[1];
    expect(storage.energies[child]).toBeCloseTo(40);
    expect(storage.generations[child]).toBe(2);
    expect(storage.parentIndices[child]).toBe(parent);
    expect(storage.typeCodes[child]).toBe(EntityTypeCode.HERBIVORE);
  });

  it('respects trophic ordering on mutated reproduction thresholds', () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const prng = createMulberry32(999);
    const genetics = new GeneticsSystem(DEFAULT_SIMULATION_CONFIG);

    const plant = pool.allocate();
    storage.initEntity(plant, {
      idHash: 50,
      typeCode: EntityTypeCode.PLANT,
      x: 100,
      y: 100,
      size: 5,
      pigment: 120,
      energy: 90, // > 55 plant threshold
      health: 100,
      reproductionThreshold: 55,
      mutationRate: 0.5, // aggressive mutation
    });

    genetics.update(1, pool, storage, prng);

    const child = pool.denseEntities[1];
    // Plant child threshold must remain strictly below herbivore threshold (65)
    expect(storage.reproductionThresholds[child]).toBeLessThan(65);
  });
});

