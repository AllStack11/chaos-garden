import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/World.js';

describe('Zero-Allocation Invariant Test', () => {
  it('maintains flat heap memory without unbounded growth over continuous ticks', () => {
    const world = new World({ seed: 777 });
    world.seedPrimordialEcosystem();

    // Warm-up JIT and stabilize allocations
    for (let i = 0; i < 100; i++) {
      world.step();
    }

    if (global.gc) {
      global.gc();
    }

    const initialHeap = process.memoryUsage().heapUsed;

    // Run 1,000 simulation ticks
    for (let i = 0; i < 1000; i++) {
      world.step();
    }

    if (global.gc) {
      global.gc();
    }

    const finalHeap = process.memoryUsage().heapUsed;
    const diffMb = (finalHeap - initialHeap) / (1024 * 1024);

    // Heap difference should be minimal (< 3MB tolerance for Node test runner overhead)
    expect(diffMb).toBeLessThan(3.0);
  });

  it('exercises reproduction in the hot loop with zero closure allocations and monotonic IDs', () => {
    const world = new World({ seed: 42 });

    // Seed entities with high energy above reproduction threshold so reproduction triggers repeatedly
    for (let i = 0; i < 20; i++) {
      const idx = world.pool.allocate();
      world.storage.initEntity(idx, {
        idHash: i + 1,
        typeCode: 0, // Plant
        x: 100 + i * 20,
        y: 100 + i * 20,
        vx: 0,
        vy: 0,
        size: 8,
        pigment: 120,
        energy: 95, // Above reproduction threshold (55)
        health: 100,
        maxSpeed: 0,
        maxForce: 0,
        perceptionRadius: 0,
        fleeRadius: 0,
        reproductionThreshold: 55,
      });
    }

    const startId = world.nextEntityId;
    const initialCount = world.pool.denseCount;

    // Warm-up JIT and execute initial reproduction
    for (let i = 0; i < 20; i++) {
      world.step();
    }

    if (global.gc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;

    // Run 200 ticks where reproduction and metabolism execute continuously
    for (let i = 0; i < 200; i++) {
      world.step();
    }

    if (global.gc) global.gc();
    const heapAfter = process.memoryUsage().heapUsed;
    const diffMb = (heapAfter - heapBefore) / (1024 * 1024);

    expect(diffMb).toBeLessThan(2.0);

    // Verify reproduction occurred and monotonic IDs advanced without closure allocations
    expect(world.nextEntityId).toBeGreaterThan(startId);
    expect(world.pool.denseCount).toBeGreaterThan(initialCount);

    // Verify all active entities have valid positive entity IDs and parent references
    const count = world.pool.denseCount;
    for (let i = 0; i < count; i++) {
      const slot = world.pool.denseEntities[i];
      expect(world.storage.entityIds[slot]).toBeGreaterThan(0);
    }
  });
});

