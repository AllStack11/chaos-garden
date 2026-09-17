import { describe, it, expect } from 'vitest';
import { MortalitySystem } from '../../src/systems/MortalitySystem.js';
import { EntityPool } from '../../src/ecs/EntityPool.js';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { SoilGrid } from '../../src/environment/SoilGrid.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('MortalitySystem (Senescence, Death & Soil Recycling)', () => {
  it('deallocates entity when lifespan is reached and deposits biomass to soil', () => {
    const pool = new EntityPool(5);
    const storage = new ComponentStorage(5);
    const soil = new SoilGrid({
      cols: 10,
      rows: 10,
      cellSize: 10,
      worldWidth: 100,
      worldHeight: 100,
    });
    soil.reset(0, 0);

    const mortality = new MortalitySystem();

    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 1,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 50,
      y: 50,
      size: 5,
      pigment: 100,
      energy: 50,
      health: 80,
      lifespan: 10,
    });

    // Advance age to 9
    storage.ages[e0] = 9;

    // Tick 1: age reaches 10 -> triggers death
    const deaths = mortality.update(pool, storage, soil);

    expect(deaths).toBe(1);
    expect(pool.denseCount).toBe(0);
    expect(pool.isActive(e0)).toBe(false);

    // Soil should have received biomass nitrates at (50, 50)
    expect(soil.getNitrates(50, 50)).toBeGreaterThan(0);
  });

  it('deallocates entity when health reaches 0 from trauma/starvation', () => {
    const pool = new EntityPool(5);
    const storage = new ComponentStorage(5);
    const soil = new SoilGrid();
    const mortality = new MortalitySystem();

    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 2,
      typeCode: EntityTypeCode.CARNIVORE,
      x: 100,
      y: 100,
      size: 10,
      pigment: 0,
      energy: 0,
      health: 0, // dead
      lifespan: 1000,
    });

    const deaths = mortality.update(pool, storage, soil);
    expect(deaths).toBe(1);
    expect(pool.denseCount).toBe(0);
  });
});

