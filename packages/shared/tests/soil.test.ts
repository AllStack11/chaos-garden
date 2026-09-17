import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SOIL_DIMENSIONS,
  DEFAULT_SOIL_CONFIG,
} from '../src/types/soil.js';

describe('Soil Grid Specifications', () => {
  it('aligns cell count with physical world dimensions', () => {
    const { cols, rows, cellSize, worldWidth, worldHeight } = DEFAULT_SOIL_DIMENSIONS;

    expect(cols * cellSize).toBe(worldWidth);
    expect(rows * cellSize).toBe(worldHeight);
    expect(cols * rows).toBe(7500); // Efficient 100x75 matrix
  });

  it('provides bounded physical diffusion rates', () => {
    const {
      moistureDiffusionRate,
      nitrateDiffusionRate,
      evaporationBaseRate,
      rootAbsorptionRate,
      fungalEnrichmentRate,
    } = DEFAULT_SOIL_CONFIG;

    expect(moistureDiffusionRate).toBeGreaterThan(0);
    expect(moistureDiffusionRate).toBeLessThan(0.25); // Courant–Friedrichs–Lewy stability condition
    expect(nitrateDiffusionRate).toBeGreaterThan(0);
    expect(evaporationBaseRate).toBeGreaterThan(0);
    expect(rootAbsorptionRate).toBeGreaterThan(0);
    expect(fungalEnrichmentRate).toBeGreaterThan(0);
  });
});

