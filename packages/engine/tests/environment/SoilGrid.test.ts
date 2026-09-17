import { describe, it, expect } from 'vitest';
import { SoilGrid } from '../../src/environment/SoilGrid.js';

describe('SoilGrid (Laplacian Diffusion & Nutrient Management)', () => {
  it('initializes with default dimensions and baseline values', () => {
    const soil = new SoilGrid({
      cols: 20,
      rows: 15,
      cellSize: 16,
      worldWidth: 320,
      worldHeight: 240,
    });

    expect(soil.cols).toBe(20);
    expect(soil.rows).toBe(15);
    expect(soil.totalCells).toBe(300);
    expect(soil.moisture.length).toBe(300);
    expect(soil.nitrates.length).toBe(300);
    expect(soil.getMoisture(100, 100)).toBeCloseTo(0.5);
    expect(soil.getNitrates(100, 100)).toBeCloseTo(0.3);
  });

  it('diffuses nutrients smoothly to adjacent cells', () => {
    const soil = new SoilGrid({
      cols: 10,
      rows: 10,
      cellSize: 10,
      worldWidth: 100,
      worldHeight: 100,
    });

    soil.reset(0, 0);

    // Deposit 1.0 nitrates at center (cell 5, 5 -> world 55, 55)
    soil.depositNitrates(55, 55, 1.0);
    expect(soil.getNitrates(55, 55)).toBe(1.0);

    // Run 1 diffusion step (with 0 evaporation)
    soil.diffuse(0.04, 0.1, 0);

    // Center cell value should decrease as it diffuses outwards
    expect(soil.getNitrates(55, 55)).toBeLessThan(1.0);

    // Immediate neighbors should now have received diffused nitrates
    expect(soil.getNitrates(45, 55)).toBeGreaterThan(0);
    expect(soil.getNitrates(65, 55)).toBeGreaterThan(0);
    expect(soil.getNitrates(55, 45)).toBeGreaterThan(0);
    expect(soil.getNitrates(55, 65)).toBeGreaterThan(0);
  });

  it('conserves mass during closed diffusion without evaporation', () => {
    const soil = new SoilGrid({
      cols: 10,
      rows: 10,
      cellSize: 10,
      worldWidth: 100,
      worldHeight: 100,
    });

    soil.reset(0, 0);
    soil.depositNitrates(50, 50, 0.8);

    const sumBefore = soil.nitrates.reduce((acc, val) => acc + val, 0);

    // Run 10 diffusion steps
    for (let i = 0; i < 10; i++) {
      soil.diffuse(0.04, 0.05, 0);
    }

    const sumAfter = soil.nitrates.reduce((acc, val) => acc + val, 0);
    expect(sumAfter).toBeCloseTo(sumBefore, 4);
  });

  it('handles toroidal edge wrapping seamlessly', () => {
    const soil = new SoilGrid({
      cols: 10,
      rows: 10,
      cellSize: 10,
      worldWidth: 100,
      worldHeight: 100,
    });

    soil.reset(0, 0);
    // Deposit at left boundary (x=5)
    soil.depositNitrates(5, 50, 1.0);

    // Diffuse 1 step
    soil.diffuse(0.04, 0.1, 0);

    // Right boundary (x=95) should have received wrapped diffusion
    expect(soil.getNitrates(95, 50)).toBeGreaterThan(0);
  });

  it('consumes and deposits nutrients correctly', () => {
    const soil = new SoilGrid({
      cols: 10,
      rows: 10,
      cellSize: 10,
      worldWidth: 100,
      worldHeight: 100,
    });

    soil.reset(0.5, 0.5);

    const consumed = soil.consumeNitrates(50, 50, 0.2);
    expect(consumed).toBeCloseTo(0.2);
    expect(soil.getNitrates(50, 50)).toBeCloseTo(0.3);

    soil.depositNitrates(50, 50, 0.4);
    expect(soil.getNitrates(50, 50)).toBeCloseTo(0.7);
  });
});

