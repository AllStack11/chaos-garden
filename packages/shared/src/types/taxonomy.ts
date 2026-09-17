/**
 * Chaos Garden - Biological Taxonomy & Genetics Contracts
 * 
 * Defines the four kingdoms of life, their genetic code, and morphological traits.
 */

import type { Vector2D } from './spatial.js';

/**
 * The four biological kingdoms in the Chaos Garden.
 */
export type EntityType = 'plant' | 'herbivore' | 'carnivore' | 'fungus';

/**
 * Numeric identifier for entity types used in high-performance
 * flat TypedArray render buffers and ECS component masks.
 */
export enum EntityTypeCode {
  PLANT = 0,
  HERBIVORE = 1,
  CARNIVORE = 2,
  FUNGUS = 3,
}

/**
 * Converts an EntityType string to its corresponding EntityTypeCode.
 */
export function getEntityTypeCode(type: EntityType): EntityTypeCode {
  switch (type) {
    case 'plant':
      return EntityTypeCode.PLANT;
    case 'herbivore':
      return EntityTypeCode.HERBIVORE;
    case 'carnivore':
      return EntityTypeCode.CARNIVORE;
    case 'fungus':
      return EntityTypeCode.FUNGUS;
  }
}

/**
 * Converts a numeric EntityTypeCode back to an EntityType string.
 */
export function getEntityTypeFromCode(code: number): EntityType {
  switch (code) {
    case EntityTypeCode.PLANT:
      return 'plant';
    case EntityTypeCode.HERBIVORE:
      return 'herbivore';
    case EntityTypeCode.CARNIVORE:
      return 'carnivore';
    case EntityTypeCode.FUNGUS:
      return 'fungus';
    default:
      return 'plant';
  }
}

/**
 * Base genetic code shared by all biological organisms.
 * Subject to mutation and natural selection across generations.
 */
export interface BaseGenome {
  /** Metabolic energy drain multiplier (0.5 to 2.0; lower is more efficient) */
  metabolismEfficiency: number;
  /** Energy required to trigger reproduction (0 to 100) */
  reproductionThreshold: number;
  /** Mutation rate for offspring (0.01 to 0.3) */
  mutationRate: number;
  /** Base physical radius in pixels */
  size: number;
  /** Maximum lifespan in ticks before senescent decay */
  lifespan: number;
  /** Color pigment hue (0 to 360), visually tracking lineage drift */
  pigment: number;
}

/**
 * Genetic traits specific to flora.
 */
export interface PlantGenome extends BaseGenome {
  /** Efficiency of converting sunlight into energy (0.5 to 2.5) */
  photosynthesisRate: number;
  /** Radius in pixels that seeds can be dispersed upon reproduction */
  seedDispersionRadius: number;
  /** Optimal soil moisture preference (0.0 to 1.0) */
  moistureAffinity: number;
}

/**
 * Genetic traits specific to herbivores.
 */
export interface HerbivoreGenome extends BaseGenome {
  /** Maximum velocity in pixels per second */
  maxSpeed: number;
  /** Maximum steering force applied per tick */
  maxForce: number;
  /** Vision radius for finding plants/food (pixels) */
  perceptionRadius: number;
  /** Detection radius for sensing predators (pixels) */
  fleePerceptionRadius: number;
  /** Weight applied to flocking with nearby herbivores (0.0 to 2.0) */
  flockingWeight: number;
}

/**
 * Genetic traits specific to carnivores.
 */
export interface CarnivoreGenome extends BaseGenome {
  /** Maximum velocity in pixels per second */
  maxSpeed: number;
  /** Maximum steering force applied per tick */
  maxForce: number;
  /** Vision radius for tracking prey (pixels) */
  huntPerceptionRadius: number;
  /** Pack hunting coordination weight (0.0 to 2.0) */
  packWeight: number;
  /** Stalking stamina / patience ticks before breaking pursuit */
  ambushPatience: number;
}

/**
 * Genetic traits specific to fungi.
 */
export interface FungusGenome extends BaseGenome {
  /** Speed at which dead matter is decomposed into soil nitrates (0.5 to 2.0) */
  decompositionRate: number;
  /** Radius in pixels for spore dispersal */
  sporeDispersionRadius: number;
  /** Rate of mycelial soil network expansion */
  myceliumSpreadRate: number;
}

/**
 * Discriminated union of genomes by kingdom.
 */
export type Genome =
  | ({ type: 'plant' } & PlantGenome)
  | ({ type: 'herbivore' } & HerbivoreGenome)
  | ({ type: 'carnivore' } & CarnivoreGenome)
  | ({ type: 'fungus' } & FungusGenome);

/**
 * High-level object model of a living entity.
 * Used for detailed inspection in Svelte HUD, lineage trees, and API snapshots.
 */
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  species: string;
  position: Vector2D;
  velocity: Vector2D;
  energy: number;   // 0 - 100
  health: number;   // 0 - 100
  age: number;      // ticks survived
  generation: number;
  parentId: string | 'origin';
  bornAtTick: number;
  isAlive: boolean;
  genome: Genome;
}

/**
 * Lightweight dead matter entry for decomposing corpses.
 * Generated when an organism dies with remaining biomass.
 * Decomposed by fungi into soil nitrates.
 */
export interface DeadMatter {
  id: string;
  type: EntityType;
  position: Vector2D;
  biomass: number;     // Remaining nutritional energy to decompose (0 to 100)
  deathTick: number;
  decayRate: number;
}

/**
 * Census summary of all living and decaying matter in the garden.
 */
export interface PopulationSummary {
  plants: number;
  herbivores: number;
  carnivores: number;
  fungi: number;
  deadMatterCount: number;
  totalLiving: number;
  totalBiomass: number;
  allTimeBirths: number;
  allTimeDeaths: number;
}

