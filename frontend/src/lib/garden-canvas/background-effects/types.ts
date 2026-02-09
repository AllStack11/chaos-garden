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

export interface BackgroundWorldState {
  tick: number;
  temperature: number;
  moisture: number;
  sunlight: number;
  totalLiving: number;
  totalEntities: number;
}
