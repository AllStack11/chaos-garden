import { describe, it, expect } from 'vitest';
import { MetabolismSystem } from '../../src/systems/MetabolismSystem.js';
import { EntityPool } from '../../src/ecs/EntityPool.js';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { SpatialHashGrid } from '../../src/spatial/SpatialHashGrid.js';
import { SoilGrid } from '../../src/environment/SoilGrid.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('MetabolismSystem (Energy, Grazing, Predation)', () => {
  it('drains metabolic energy per tick and applies starvation decay', () => {
    const pool = new EntityPool(5);
    const storage = new ComponentStorage(5);
    const spatialGrid = new SpatialHashGrid();
    const soil = new SoilGrid();
    const metabolism = new MetabolismSystem(0.06, 0.5);

    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 1,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 100,
      y: 100,
      size: 5,
      pigment: 100,
      energy: 1.0,
      health: 100,
      metabolismRate: 0.1, // 0.1 * 1.0 * 60 = 6.0 drain -> depletes energy to 0
    });

    metabolism.update(1.0, pool, storage, spatialGrid, soil);

    expect(storage.energies[e0]).toBe(0);
    expect(storage.healths[e0]).toBeLessThan(100); // starvation damage applied
  });

  it('allows hungry herbivore to graze on nearby plant', () => {
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
      x: 100,
      y: 100,
      size: 10,
      pigment: 120,
      energy: 80,
      health: 100,
      metabolismRate: 0,
    });

    const herbivore = pool.allocate();
    storage.initEntity(herbivore, {
      idHash: 20,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 105,
      y: 100, // close to plant
      size: 8,
      pigment: 180,
      energy: 40, // hungry
      health: 100,
      metabolismRate: 0,
    });

    spatialGrid.clear();
    spatialGrid.insert(plant, 100, 100);
    spatialGrid.insert(herbivore, 105, 100);

    metabolism.update(1.0, pool, storage, spatialGrid, soil);

    // Herbivore energy should have increased from grazing
    expect(storage.energies[herbivore]).toBeGreaterThan(40);
    // Plant energy should have decreased from bite
    expect(storage.energies[plant]).toBeLessThan(80);
  });
});

