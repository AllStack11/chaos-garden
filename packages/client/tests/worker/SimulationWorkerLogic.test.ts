import { describe, it, expect } from 'vitest';
import { World } from '@chaos-garden/engine';
import { EntityTypeCode, type EncodedEngineCheckpoint } from '@chaos-garden/shared';

describe('Simulation Worker & World Integration Logic (Phase 3)', () => {
  it('candidate World hydrates valid checkpoint and promotes bit-identically', async () => {
    const originalWorld = new World({ seed: 42 });
    originalWorld.seedPrimordialEcosystem();

    // Advance 50 ticks
    for (let i = 0; i < 50; i++) {
      originalWorld.step();
    }

    const checkpoint = await originalWorld.exportEngineCheckpoint();
    expect(checkpoint.checksum).toBeTruthy();
    expect(checkpoint.tick).toBe(50);

    // Hydrate candidate World
    const candidateWorld = new World({ seed: 42 });
    const success = await candidateWorld.hydrateEngineCheckpoint(checkpoint);
    expect(success).toBe(true);
    expect(candidateWorld.tick).toBe(50);

    // Both worlds advance 25 ticks with identical PRNG and yields identical entity coordinates
    for (let i = 0; i < 25; i++) {
      originalWorld.step();
      candidateWorld.step();
    }

    expect(candidateWorld.tick).toBe(75);
    expect(candidateWorld.storage.positionsX[0]).toBe(originalWorld.storage.positionsX[0]);
    expect(candidateWorld.storage.positionsY[0]).toBe(originalWorld.storage.positionsY[0]);
  });

  it('discards candidate World on checksum corruption without affecting state', async () => {
    const originalWorld = new World({ seed: 42 });
    originalWorld.seedPrimordialEcosystem();
    const checkpoint = await originalWorld.exportEngineCheckpoint();

    // Corrupt checksum
    const corruptCheckpoint: EncodedEngineCheckpoint = {
      ...checkpoint,
      checksum: 'bad0000000000000000000000000000000000000000000000000000000000000',
    };

    const candidateWorld = new World({ seed: 42 });
    const success = await candidateWorld.hydrateEngineCheckpoint(corruptCheckpoint);
    expect(success).toBe(false);
    expect(candidateWorld.tick).toBe(0); // Candidate remains unpromoted
  });

  it('World-owned spawnOrganism generates monotonic entityId and parentEntityId = 0', () => {
    const world = new World({ seed: 42 });
    expect(world.nextEntityId).toBe(1);

    const id1 = world.spawnOrganism(EntityTypeCode.HERBIVORE, { x: 100, y: 150 });
    const id2 = world.spawnOrganism(EntityTypeCode.CARNIVORE, { x: 200, y: 250 });

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(world.nextEntityId).toBe(3);

    const vitals1 = world.getEntityVitals(id1);
    expect(vitals1).not.toBeNull();
    expect(vitals1?.entityId).toBe(1);
    expect(vitals1?.parentEntityId).toBe(0);
    expect(vitals1?.type).toBe(EntityTypeCode.HERBIVORE);
    expect(vitals1?.species).toBe('Herbivore');
    expect(vitals1?.name).toBe('Amoebic Boid #1');

    const vitals2 = world.getEntityVitals(id2);
    expect(vitals2?.entityId).toBe(2);
    expect(vitals2?.parentEntityId).toBe(0);
    expect(vitals2?.type).toBe(EntityTypeCode.CARNIVORE);
    expect(vitals2?.species).toBe('Carnivore');
    expect(vitals2?.name).toBe('Predatory Dart #2');
  });

  it('deterministic spatial picking resolves closest entity by durable entityId', () => {
    const world = new World({ seed: 42 });
    const id1 = world.spawnOrganism(EntityTypeCode.PLANT, { x: 100, y: 100 });
    const id2 = world.spawnOrganism(EntityTypeCode.HERBIVORE, { x: 130, y: 100 });

    // Pick near (102, 101) - within radius 20
    const pickedNear1 = world.pickEntityAt({ x: 102, y: 101 }, 20);
    expect(pickedNear1).toBe(id1);

    // Pick near (128, 101) - within radius 20
    const pickedNear2 = world.pickEntityAt({ x: 128, y: 101 }, 20);
    expect(pickedNear2).toBe(id2);

    // Pick at empty spot far away
    const pickedEmpty = world.pickEntityAt({ x: 500, y: 500 }, 20);
    expect(pickedEmpty).toBeNull();
  });

  it('terminateOrganism removes entity and updates active count', () => {
    const world = new World({ seed: 42 });
    const id1 = world.spawnOrganism(EntityTypeCode.FUNGUS, { x: 50, y: 50 });
    expect(world.pool.denseCount).toBe(1);

    const terminated = world.terminateOrganism(id1);
    expect(terminated).toBe(true);
    expect(world.pool.denseCount).toBe(0);

    // Vitals should return null after termination
    expect(world.getEntityVitals(id1)).toBeNull();

    // Terminating non-existent ID returns false
    expect(world.terminateOrganism(9999)).toBe(false);
  });
});
