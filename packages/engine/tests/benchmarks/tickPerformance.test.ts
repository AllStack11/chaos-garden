import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('Tick Performance Benchmark', () => {
  it('executes simulation ticks in <= 2.5ms under full load (2,000 entities)', () => {
    const world = new World({ seed: 42 });

    // Populate full load (2,000 entities matching maximum ecosystem limits: 1000 plants, 500 herbivores, 200 carnivores, 300 fungi)
    for (let i = 0; i < 2000; i++) {
      const idx = world.pool.allocate();
      if (idx === -1) break;

      let type: EntityTypeCode;
      if (i < 1000) type = EntityTypeCode.PLANT;
      else if (i < 1500) type = EntityTypeCode.HERBIVORE;
      else if (i < 1700) type = EntityTypeCode.CARNIVORE;
      else type = EntityTypeCode.FUNGUS;

      world.storage.initEntity(idx, {
        idHash: i + 1,
        typeCode: type,
        x: (i * 37) % 1600,
        y: (i * 41) % 1200,
        vx: 2.0,
        vy: 1.5,
        size: 8,
        pigment: (i * 10) % 360,
        energy: 70,
        health: 100,
        maxSpeed: 20,
        maxForce: 5,
        perceptionRadius: 50,
        fleeRadius: 60,
      });
    }

    expect(world.pool.denseCount).toBe(2000);

    // Warm up 50 ticks for V8 TurboFan optimization
    for (let i = 0; i < 50; i++) {
      world.step();
    }

    // Benchmark across 8 trials of 40 ticks and take the best average to eliminate OS thread preemption jitter
    let bestAvgMs = Infinity;
    for (let trial = 0; trial < 8; trial++) {
      const start = performance.now();
      for (let i = 0; i < 40; i++) {
        world.step();
      }
      const elapsed = performance.now() - start;
      const trialAvg = elapsed / 40;
      if (trialAvg < bestAvgMs) {
        bestAvgMs = trialAvg;
      }
    }

    // Must beat 2.5ms budget
    expect(bestAvgMs).toBeLessThanOrEqual(2.5);
  });
});
