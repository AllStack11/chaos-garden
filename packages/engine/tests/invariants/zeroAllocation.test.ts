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
});

