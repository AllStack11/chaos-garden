import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { EntityPool } from '../../src/ecs/EntityPool.js';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { SpatialHashGrid } from '../../src/spatial/SpatialHashGrid.js';
import { MetabolismSystem } from '../../src/systems/MetabolismSystem.js';
import { PhysicsSystem } from '../../src/systems/PhysicsSystem.js';
import { SoilGrid } from '../../src/environment/SoilGrid.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('Phase 2 Remediation Defect Reproductions', () => {
  describe('1. Render Buffer Lifecycle', () => {
    it('returns null on 4th transferable frame request when 3 buffers are in flight without returns', () => {
      const world = new World();
      world.seedPrimordialEcosystem();

      // Step and acquire 3 frames
      world.step();
      const frame1 = world.getTransferableRenderFrame();
      world.step();
      const frame2 = world.getTransferableRenderFrame();
      world.step();
      const frame3 = world.getTransferableRenderFrame();

      expect(frame1).not.toBeNull();
      expect(frame2).not.toBeNull();
      expect(frame3).not.toBeNull();

      // 4th step without returning any buffer
      world.step();
      const frame4 = world.getTransferableRenderFrame();
      expect(frame4).toBeNull();
    });

    it('rejects invalid or duplicate returned buffers and admits only valid pool buffers', () => {
      const world = new World();
      world.seedPrimordialEcosystem();
      world.step();

      const frame1 = world.getTransferableRenderFrame();
      expect(frame1).not.toBeNull();

      // Returning an unknown buffer should return false
      const alienBuffer = new Float32Array(world.config.maxTotalEntities * 8);
      const alienResult = world.returnRenderBuffer(alienBuffer);
      expect(alienResult).toBe(false);

      // Returning the valid buffer should return true
      const validResult = world.returnRenderBuffer(frame1!.buffer);
      expect(validResult).toBe(true);

      // Returning the same buffer again (duplicate) should return false
      const duplicateResult = world.returnRenderBuffer(frame1!.buffer);
      expect(duplicateResult).toBe(false);
    });
  });

  describe('2. Exact and Current Spatial Interactions', () => {
    it('does not graze on target in same bucket cell but outside interaction radius', () => {
      const pool = new EntityPool(5);
      const storage = new ComponentStorage(5);
      const spatialGrid = new SpatialHashGrid({
        worldWidth: 500,
        worldHeight: 500,
        cellSize: 50,
        maxEntities: 5,
      });
      const soil = new SoilGrid();
      const metabolism = new MetabolismSystem();

      const plant = pool.allocate();
      storage.initEntity(plant, {
        idHash: 10,
        typeCode: EntityTypeCode.PLANT,
        x: 45,
        y: 45,
        size: 6,
        pigment: 120,
        energy: 80,
        health: 100,
        metabolismRate: 0,
      });

      const herbivore = pool.allocate();
      storage.initEntity(herbivore, {
        idHash: 20,
        typeCode: EntityTypeCode.HERBIVORE,
        x: 10,
        y: 10, // In same 50x50 cell as (45, 45), but distance is sqrt(35^2 + 35^2) = ~49.5
        size: 8, // Interaction radius = 8 + 16 = 24. 49.5 > 24!
        pigment: 180,
        energy: 40,
        health: 100,
        metabolismRate: 0,
      });

      spatialGrid.clear();
      spatialGrid.insert(plant, 45, 45);
      spatialGrid.insert(herbivore, 10, 10);

      metabolism.update(1.0, pool, storage, spatialGrid, soil);

      // Plant should NOT be bitten because it is outside radial distance 24
      expect(storage.energies[plant]).toBe(80);
      expect(storage.energies[herbivore]).toBe(40);
    });

    it('interacts with targets across toroidal boundaries within exact radius', () => {
      const pool = new EntityPool(5);
      const storage = new ComponentStorage(5);
      const spatialGrid = new SpatialHashGrid({
        worldWidth: 1000,
        worldHeight: 1000,
        cellSize: 50,
        maxEntities: 5,
      });
      const soil = new SoilGrid();
      const metabolism = new MetabolismSystem();

      const plant = pool.allocate();
      storage.initEntity(plant, {
        idHash: 10,
        typeCode: EntityTypeCode.PLANT,
        x: 998, // Right edge
        y: 500,
        size: 6,
        pigment: 120,
        energy: 80,
        health: 100,
        metabolismRate: 0,
      });

      const herbivore = pool.allocate();
      storage.initEntity(herbivore, {
        idHash: 20,
        typeCode: EntityTypeCode.HERBIVORE,
        x: 2, // Left edge, toroidal dx = 4 <= 24
        y: 500,
        size: 8,
        pigment: 180,
        energy: 40,
        health: 100,
        metabolismRate: 0,
      });

      spatialGrid.clear();
      spatialGrid.insert(plant, 998, 500);
      spatialGrid.insert(herbivore, 2, 500);

      metabolism.update(1.0, pool, storage, spatialGrid, soil);

      // Herbivore should graze on plant across toroidal boundary
      expect(storage.energies[plant]).toBeLessThan(80);
      expect(storage.energies[herbivore]).toBeGreaterThan(40);
    });

    it('selects nearest valid candidate even when there are more than 32 candidates', () => {
      const pool = new EntityPool(50);
      const storage = new ComponentStorage(50);
      const spatialGrid = new SpatialHashGrid({
        worldWidth: 1000,
        worldHeight: 1000,
        cellSize: 100,
        maxEntities: 50,
      });
      const soil = new SoilGrid();
      const metabolism = new MetabolismSystem();

      // Insert 35 plants at distance 20
      for (let i = 0; i < 35; i++) {
        const p = pool.allocate();
        storage.initEntity(p, {
          idHash: 100 + i,
          typeCode: EntityTypeCode.PLANT,
          x: 500 + 20,
          y: 500,
          size: 6,
          pigment: 120,
          energy: 80,
          health: 100,
          metabolismRate: 0,
        });
        spatialGrid.insert(p, 520, 500);
      }

      // Insert 1 very close plant at distance 3 (inserted after 35 others)
      const closePlant = pool.allocate();
      storage.initEntity(closePlant, {
        idHash: 999,
        typeCode: EntityTypeCode.PLANT,
        x: 503,
        y: 500,
        size: 6,
        pigment: 120,
        energy: 80,
        health: 100,
        metabolismRate: 0,
      });
      spatialGrid.insert(closePlant, 503, 500);

      const herbivore = pool.allocate();
      storage.initEntity(herbivore, {
        idHash: 20,
        typeCode: EntityTypeCode.HERBIVORE,
        x: 500,
        y: 500,
        size: 8,
        pigment: 180,
        energy: 40,
        health: 100,
        metabolismRate: 0,
      });
      spatialGrid.insert(herbivore, 500, 500);

      metabolism.update(1.0, pool, storage, spatialGrid, soil);

      // The closest plant (closePlant) must be the one consumed!
      expect(storage.energies[closePlant]).toBeLessThan(80);
    });

    it('interacts based on post-physics position after movement', () => {
      const world = new World({
        seed: 42,
        config: {
          gardenWidth: 1000,
          gardenHeight: 1000,
          maxTotalEntities: 10,
          initialPlants: 0,
          initialHerbivores: 0,
          initialCarnivores: 0,
          initialFungi: 0,
          targetTps: 60,
          maxPlants: 10,
          maxHerbivores: 10,
          maxCarnivores: 10,
          maxFungi: 10,
          baseEnergyCostPerTick: 0,
          basePhotosynthesisRate: 0,
          plantReproductionThreshold: 100,
          herbivoreReproductionThreshold: 100,
          carnivoreReproductionThreshold: 100,
          fungusReproductionThreshold: 100,
          mutationProbability: 0,
          mutationMagnitude: 0,
        },
      });

      // Plant placed at (205, 100)
      const plantIdx = world.pool.allocate();
      world.storage.initEntity(plantIdx, {
        idHash: 1,
        typeCode: EntityTypeCode.PLANT,
        x: 205,
        y: 100,
        size: 6,
        pigment: 120,
        energy: 80,
        health: 100,
        metabolismRate: 0,
      });

      // Herbivore starts at (100, 100) with vx = 6000 (moves 100 units in 1 tick of dt = 1/60)
      // After physics, herbivore is at (200, 100), in range of plant at (205, 100)
      const herbIdx = world.pool.allocate();
      world.storage.initEntity(herbIdx, {
        idHash: 2,
        typeCode: EntityTypeCode.HERBIVORE,
        x: 100,
        y: 100,
        vx: 6000,
        vy: 0,
        maxSpeed: 6000,
        size: 8,
        pigment: 180,
        energy: 40,
        health: 100,
        metabolismRate: 0,
      });

      world.step(1 / 60);

      // Herbivore should have reached (200, 100) and fed on plant at (205, 100)
      expect(world.storage.energies[plantIdx]).toBeLessThan(80);
      expect(world.storage.energies[herbIdx]).toBeGreaterThan(40);
    });
  });

  describe('3. Durable Identity and Lineage', () => {
    it('preserves immutable parent ID when parent slot is killed and recycled', () => {
      const world = new World();
      const parentIdx = world.pool.allocate();
      world.storage.initEntity(parentIdx, {
        idHash: 100,
        typeCode: EntityTypeCode.HERBIVORE,
        x: 100,
        y: 100,
        size: 8,
        pigment: 180,
        energy: 100,
        health: 100,
      });
      const parentEntityId = (world.storage as any).entityIds
        ? (world.storage as any).entityIds[parentIdx]
        : 1;

      // Child born from parent
      const childIdx = world.pool.allocate();
      world.storage.initEntity(childIdx, {
        idHash: 200,
        typeCode: EntityTypeCode.HERBIVORE,
        x: 105,
        y: 105,
        size: 8,
        pigment: 180,
        energy: 50,
        health: 100,
        generation: 2,
      });
      if ((world.storage as any).parentEntityIds) {
        (world.storage as any).parentEntityIds[childIdx] = parentEntityId;
      }

      // Kill parent and free slot
      world.pool.free(parentIdx);
      world.storage.resetEntity(parentIdx);

      // Allocate same slot for an unrelated new entity
      const newIdx = world.pool.allocate();
      expect(newIdx).toBe(parentIdx); // Slot was recycled
      world.storage.initEntity(newIdx, {
        idHash: 300,
        typeCode: EntityTypeCode.CARNIVORE,
        x: 400,
        y: 400,
        size: 12,
        pigment: 0,
        energy: 80,
        health: 100,
      });

      // Child's parentEntityId must still be the original parentEntityId
      expect((world.storage as any).parentEntityIds[childIdx]).toBe(parentEntityId);
    });
  });
});
