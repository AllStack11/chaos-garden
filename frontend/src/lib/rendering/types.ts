/**
 * Rendering Types
 * 
 * Shared type definitions for the rendering system.
 */

/**
 * Complete visual properties for any entity
 */
export interface EntityVisual {
  // Identity
  type: EntityTypeVisual;
  visualSeed: number;
  
  // Structural
  size: number;
  scale: number;
  
  // Health/Energy
  healthFactor: number;
  energyFactor: number;
  
  // Movement
  velocity?: { x: number; y: number };
  direction?: number;
  
  // State
  isSelected: boolean;
  isHunting: boolean;
  isNight: boolean;
}

/**
 * Entity type for rendering
 */
export type EntityTypeVisual = 'plant' | 'herbivore' | 'carnivore' | 'fungus';

/**
 * Rendering configuration
 */
export interface RenderConfig {
  showNames: boolean;
  showHealthBars: boolean;
  showSelectionHighlight: boolean;
  particleIntensity: number;
  lodDistance: number;
}

/**
 * Position on canvas
 */
export interface ScreenPosition {
  x: number;
  y: number;
  scale: number;
}

/**
 * Animation state for an entity
 */
export interface AnimationState {
  time: number;
  phase: number;
  bobOffset: number;
  swayOffset: number;
  breathOffset: number;
}

/**
 * Particle effect data
 */
export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
  opacity: number;
  type: ParticleType;
}

export type ParticleType = 'spore' | 'glow' | 'sparkle' | 'death' | 'birth' | 'eat';

export type TimePhase = 'night' | 'dawn' | 'day' | 'dusk';
export type QualityTier = 'high' | 'medium' | 'low';

export interface LightingContext {
  sunlight: number;
  ambientLevel: number;
  sunDirection: number;
  colorTemperature: number;
  fogDensity: number;
  shadowStrength: number;
  bloomFactor: number;
}

export interface PlantGenome {
  branchDepth: number;
  phyllotaxisAngle: number;
  petalDeformation: number;
  veinDensity: number;
  silhouetteNoise: number;
}

export interface HerbivoreGenome {
  segmentRatioA: number;
  segmentRatioB: number;
  gaitProfile: number;
  appendageStyle: number;
  patternMapSeed: number;
}

export interface CarnivoreGenome {
  stanceProfile: number;
  tailDynamics: number;
  stripeMaskFrequency: number;
  spotMaskFrequency: number;
}

export interface FungusGenome {
  colonyTopology: number;
  capUndulationProfile: number;
  sporeVentCadence: number;
}

export interface VisualGenome {
  seed: number;
  plant: PlantGenome;
  herbivore: HerbivoreGenome;
  carnivore: CarnivoreGenome;
  fungus: FungusGenome;
}

export interface RuntimeVisualState {
  healthOverlay: number;
  energyOverlay: number;
  sunlightOverlay: number;
  lifecycleOverlay: number;
}
