import type { LightingContext, QualityTier, TimePhase } from '../../rendering/types.ts';

export interface SporeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  depth: number;
}

export interface ShadowBlob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

export interface GlitchSpark {
  x: number;
  y: number;
  opacity: number;
  size: number;
  lifetime: number;
  color: string;
  shape: number;
}

export interface RippleEffect {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  eventType: 'REPRODUCTION' | 'DEATH' | 'PREDATION' | 'POPULATION';
}

export interface BiomeCell {
  x: number;
  y: number;
  size: number;
  moisture: number;
  fertility: number;
  corruption: number;
  tilt: number;
  radiusX: number;
  radiusY: number;
  offsetX: number;
  offsetY: number;
  shapeType: number;
  curveVariation: number;
}

export interface RootPressureCell {
  x: number;
  y: number;
  size: number;
  pressure: number;
  tilt: number;
}

export interface MemoryRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  age: number;
  maxAge: number;
  ringType: 'growth' | 'decay' | 'stress' | 'population';
}

export interface ParallaxBand {
  baseY: number;
  amplitude: number;
  wavelength: number;
  phase: number;
  speed: number;
  opacity: number;
  thickness: number;
  hue: number;
  depth: number;
}

export interface CanopyNode {
  id: number;
  x: number;
  y: number;
  depth: number;
}

export interface CanopyEdge {
  fromId: number;
  toId: number;
  thickness: number;
  curve: number;
  weight: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PointerPosition {
  x: number;
  y: number;
}

export type BackgroundPass =
  | 'farBackground'
  | 'terrain'
  | 'ambientAtmosphere'
  | 'entityShadows'
  | 'entitiesBase'
  | 'entityOverlays'
  | 'foregroundParticles'
  | 'postLightVeil';

export interface BackgroundPassContext {
  pass: BackgroundPass;
  lighting: LightingContext;
  qualityTier: QualityTier;
  timePhase: TimePhase;
}

export interface RainDropParticle {
  x: number;
  y: number;
  velocity: number;
  length: number;
  opacity: number;
  windOffset: number;
}

export interface FogPatch {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  driftSpeed: number;
  driftAngle: number;
}

export interface BackgroundWorldState {
  tick: number;
  temperature: number;
  moisture: number;
  sunlight: number;
  totalLiving: number;
  totalEntities: number;
  plantDensity?: number;
  fungusDensity?: number;
  predatorPressure?: number;
  diversityIndex?: number;
  eventIntensity?: number;
  weatherStateName?: string;
  weatherTransitionProgress?: number;
}

export interface FireflyParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  glowPhase: number;
  glowSpeed: number;
  baseOpacity: number;
  size: number;
  height: number;
}

export interface Star {
  x: number;
  y: number;
  brightness: number;
  twinklePhase: number;
  twinkleSpeed: number;
  size: number;
}

export interface GodRay {
  originX: number;
  originY: number;
  angle: number;
  width: number;
  length: number;
  opacity: number;
}

export interface AuroraWave {
  baseY: number;
  amplitude: number;
  wavelength: number;
  phase: number;
  speed: number;
  hue: number;
  opacity: number;
  thickness: number;
}

export interface WindLeaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: 'green' | 'yellow' | 'orange' | 'pink';
  opacity: number;
  depth: number;
}

export interface PollenParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  clusterPhase: number;
}

export interface MistLayer {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  driftSpeed: number;
  altitude: number;
}

export interface Dewdrop {
  x: number;
  y: number;
  sparklePhase: number;
  sparkleSpeed: number;
  size: number;
}

export interface DustDevil {
  x: number;
  y: number;
  vx: number;
  radius: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  lifetime: number;
  maxLifetime: number;
  particleCount: number;
  particles: { angle: number; distance: number; height: number; size: number }[];
}

export interface FlowerBloom {
  x: number;
  y: number;
  bloomProgress: number;
  hue: number;
  size: number;
  petalCount: number;
}

export interface MushroomSprite {
  x: number;
  y: number;
  growthProgress: number;
  capRadius: number;
  stemHeight: number;
  hue: number;
  age: number;
  maxAge: number;
}

export interface SeasonalGroundParticle {
  x: number;
  y: number;
  size: number;
  rotation: number;
  colorVariant: number;
  type: 'leaf' | 'snow' | 'dust';
}

export interface Puddle {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  opacity: number;
  ripplePhase: number;
}

export interface Footprint {
  x: number;
  y: number;
  angle: number;
  size: number;
  opacity: number;
  age: number;
  maxAge: number;
  entityType: 'herbivore' | 'carnivore';
}
