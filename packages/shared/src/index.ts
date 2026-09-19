/**
 * @chaos-garden/shared
 * 
 * Core types, mathematical primitives, binary protocols, and API contracts
 * for the Chaos Garden living digital ecosystem.
 */

// Taxonomy & Genetics
export * from './types/taxonomy.js';

// Spatial & Geometric
export * from './types/spatial.js';

// Soil & Nutrient Matrix
export * from './types/soil.js';

// Render Stride & Worker Protocols
export * from './types/render.js';

// Weather & Atmosphere
export * from './types/weather.js';

// Observability & Diagnostics
export * from './types/diagnostics.js';

// Client-Server Contracts
export * from './types/contracts.js';

// Simulation Configuration
export * from './types/config.js';

// Math Utilities
export * from './math/vector.js';
export * from './math/random.js';
export * from './math/stride.js';

// Codec & Cryptographic Utilities
export * from './utils/codec.js';

// ==========================================
// Backward Compatibility Aliases
// ==========================================
import type { Vector2D } from './types/spatial.js';
import type { BaseGenome, PlantGenome, HerbivoreGenome, CarnivoreGenome, FungusGenome } from './types/taxonomy.js';

export type Position = Vector2D;
export type BaseTraits = BaseGenome;
export type PlantTraits = PlantGenome;
export type HerbivoreTraits = HerbivoreGenome;
export type CarnivoreTraits = CarnivoreGenome;
export type FungusTraits = FungusGenome;

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

