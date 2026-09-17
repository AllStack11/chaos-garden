/**
 * Chaos Garden - Spatial & Geometric Types
 */

/**
 * 2D vector coordinate.
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Axis-Aligned Bounding Box for spatial queries and viewport culling.
 */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Physical garden boundary dimensions.
 */
export interface GardenDimensions {
  width: number;
  height: number;
}

/**
 * Spatial hash grid partitioning configuration for O(1) proximity lookups.
 */
export interface SpatialHashConfig {
  cellSize: number;
  cols: number;
  rows: number;
  worldWidth: number;
  worldHeight: number;
}

/**
 * Default simulation world dimensions (in continuous world units).
 */
export const DEFAULT_GARDEN_DIMENSIONS: GardenDimensions = {
  width: 1600,
  height: 1200,
};

