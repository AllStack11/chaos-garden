export interface SporeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
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

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PointerPosition {
  x: number;
  y: number;
}
