/**
 * Chaos Garden - Soil Nutrient & Moisture Grid Types
 * 
 * Defines the 2D living substrate where plants draw water and nitrates,
 * and fungi recycle decomposed corpses into rich, fertile soil pockets.
 */

/**
 * Dimensions and cell resolution for the 2D soil grid.
 */
export interface SoilGridDimensions {
  cols: number;
  rows: number;
  cellSize: number;
  worldWidth: number;
  worldHeight: number;
}

/**
 * 2D scalar fields representing the physical state of the garden soil.
 * Values are normalized between 0.0 (arid/sterile) and 1.0 (saturated/hyper-fertile).
 */
export interface SoilGridState {
  cols: number;
  rows: number;
  cellSize: number;
  /** Moisture buffer (0.0 = completely desiccated, 1.0 = waterlogged) */
  moisture: Float32Array | number[];
  /** Nitrate/organic fertility buffer (0.0 = sterile sand, 1.0 = rich compost) */
  nitrates: Float32Array | number[];
}

/**
 * Physical diffusion and consumption constants for the soil engine.
 */
export interface SoilDiffusionConfig {
  /** How quickly moisture diffuses to adjacent cells per tick */
  moistureDiffusionRate: number;
  /** How quickly decomposed nitrates seep into adjacent cells per tick */
  nitrateDiffusionRate: number;
  /** Base moisture loss to atmosphere per tick (accelerated by sunlight/temperature) */
  evaporationBaseRate: number;
  /** Efficiency with which roots absorb local soil moisture */
  rootAbsorptionRate: number;
  /** Efficiency with which fungi convert carcass biomass into soil nitrates */
  fungalEnrichmentRate: number;
}

/**
 * Default soil configuration:
 * For a 1600x1200 world, a cellSize of 16 produces a 100x75 grid (7,500 cells).
 * This fits comfortably in a single GPU texture and executes in <0.5ms on CPU.
 */
export const DEFAULT_SOIL_DIMENSIONS: SoilGridDimensions = {
  cols: 100,
  rows: 75,
  cellSize: 16,
  worldWidth: 1600,
  worldHeight: 1200,
};

export const DEFAULT_SOIL_CONFIG: SoilDiffusionConfig = {
  moistureDiffusionRate: 0.04,
  nitrateDiffusionRate: 0.02,
  evaporationBaseRate: 0.001,
  rootAbsorptionRate: 0.015,
  fungalEnrichmentRate: 0.05,
};

