import { describe, it, expect } from 'vitest';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('ComponentStorage (SoA Memory Layout)', () => {
  it('allocates contiguous TypedArrays with requested capacity', () => {
    const storage = new ComponentStorage(100);
    expect(storage.capacity).toBe(100);
    expect(storage.positionsX.length).toBe(100);
    expect(storage.positionsY.length).toBe(100);
    expect(storage.velocitiesX.length).toBe(100);
    expect(storage.velocitiesY.length).toBe(100);
    expect(storage.energies.length).toBe(100);
    expect(storage.healths.length).toBe(100);
    expect(storage.typeCodes.length).toBe(100);
    expect(storage.idHashes.length).toBe(100);
  });

  it('initializes and resets entity slot without heap allocations', () => {
    const storage = new ComponentStorage(10);

    storage.initEntity(3, {
      idHash: 987654,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 120.5,
      y: 340.2,
      vx: 1.5,
      vy: -2.0,
      size: 8.0,
      pigment: 180,
      energy: 85,
      health: 95,
      maxSpeed: 4.5,
      maxForce: 0.2,
    });

    expect(storage.idHashes[3]).toBe(987654);
    expect(storage.typeCodes[3]).toBe(EntityTypeCode.HERBIVORE);
    expect(storage.positionsX[3]).toBeCloseTo(120.5);
    expect(storage.positionsY[3]).toBeCloseTo(340.2);
    expect(storage.velocitiesX[3]).toBeCloseTo(1.5);
    expect(storage.velocitiesY[3]).toBeCloseTo(-2.0);
    expect(storage.sizes[3]).toBeCloseTo(8.0);
    expect(storage.pigments[3]).toBeCloseTo(180);
    expect(storage.energies[3]).toBeCloseTo(85);
    expect(storage.healths[3]).toBeCloseTo(95);
    expect(storage.maxSpeeds[3]).toBeCloseTo(4.5);
    expect(storage.maxForces[3]).toBeCloseTo(0.2);

    storage.resetEntity(3);
    expect(storage.idHashes[3]).toBe(0);
    expect(storage.typeCodes[3]).toBe(0);
    expect(storage.positionsX[3]).toBe(0);
    expect(storage.energies[3]).toBe(0);
  });

  it('clears all entities to defaults', () => {
    const storage = new ComponentStorage(5);
    storage.initEntity(0, {
      idHash: 111,
      typeCode: EntityTypeCode.PLANT,
      x: 10,
      y: 20,
      size: 5,
      pigment: 120,
    });
    storage.initEntity(1, {
      idHash: 222,
      typeCode: EntityTypeCode.CARNIVORE,
      x: 30,
      y: 40,
      size: 15,
      pigment: 0,
    });

    storage.clearAll();
    expect(storage.idHashes[0]).toBe(0);
    expect(storage.idHashes[1]).toBe(0);
    expect(storage.parentIndices[0]).toBe(-1);
    expect(storage.parentIndices[1]).toBe(-1);
  });
});

