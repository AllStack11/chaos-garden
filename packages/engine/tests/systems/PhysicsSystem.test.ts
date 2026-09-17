import { describe, it, expect } from 'vitest';
import { PhysicsSystem } from '../../src/systems/PhysicsSystem.js';
import { EntityPool } from '../../src/ecs/EntityPool.js';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('PhysicsSystem (Integration & Boundaries)', () => {
  it('integrates acceleration into velocity and clamps to maxSpeed', () => {
    const pool = new EntityPool(5);
    const storage = new ComponentStorage(5);
    const physics = new PhysicsSystem(1000, 1000);

    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 1,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 100,
      y: 100,
      vx: 5,
      vy: 0,
      size: 10,
      pigment: 100,
      maxSpeed: 10,
    });

    // Apply massive acceleration
    storage.accelerationsX[e0] = 100;
    storage.accelerationsY[e0] = 0;

    physics.update(1.0, pool, storage);

    // Velocity should be capped at maxSpeed (10)
    expect(storage.velocitiesX[e0]).toBeCloseTo(10);
    expect(storage.accelerationsX[e0]).toBe(0); // reset
    expect(storage.positionsX[e0]).toBeCloseTo(110);
  });

  it('wraps coordinates toroidally across world borders', () => {
    const pool = new EntityPool(5);
    const storage = new ComponentStorage(5);
    const physics = new PhysicsSystem(200, 200);

    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 1,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 195,
      y: 100,
      vx: 10, // will step to 205 -> wraps to 5
      vy: 0,
      size: 5,
      pigment: 50,
      maxSpeed: 20,
    });

    physics.update(1.0, pool, storage);
    expect(storage.positionsX[e0]).toBeCloseTo(5);

    // Test negative border wrap
    storage.velocitiesX[e0] = -15; // 5 - 15 = -10 -> wraps to 190
    physics.update(1.0, pool, storage);
    expect(storage.positionsX[e0]).toBeCloseTo(190);
  });
});

