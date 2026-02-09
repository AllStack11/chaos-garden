import type {
  GlitchSpark,
  PointerPosition,
  ShadowBlob,
  SporeParticle,
  ViewportSize,
} from './types.ts';

const SHADOW_COUNT = 8;
const SPORE_COUNT = 60;
const GLITCH_COLORS = [
  '255, 100, 180',
  '100, 220, 255',
  '180, 120, 255',
  '255, 200, 100',
  '100, 180, 255',
  '220, 255, 100',
];

export interface BackgroundAnimationState {
  spores: SporeParticle[];
  shadows: ShadowBlob[];
  glitchSparks: GlitchSpark[];
  lastGlitchTime: number;
}

export function createBackgroundAnimationState(viewport: ViewportSize): BackgroundAnimationState {
  return {
    spores: createSporeParticles(viewport),
    shadows: createShadowBlobs(viewport),
    glitchSparks: [],
    lastGlitchTime: 0,
  };
}

export function resizeBackgroundAnimationState(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
): void {
  state.spores = createSporeParticles(viewport);
  state.shadows = createShadowBlobs(viewport);
}

export function updateBackgroundAnimationState(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
  mousePos: PointerPosition,
  targetMousePos: PointerPosition,
  now: number,
): void {
  mousePos.x += (targetMousePos.x - mousePos.x) * 0.05;
  mousePos.y += (targetMousePos.y - mousePos.y) * 0.05;

  updateSporeParticles(state.spores, viewport);
  updateShadowBlobs(state.shadows, viewport);

  if (now - state.lastGlitchTime > 2000 + Math.random() * 6000) {
    addGlitchSpark(state.glitchSparks, viewport);
    state.lastGlitchTime = now;
  }

  state.glitchSparks = state.glitchSparks.filter((spark) => spark.lifetime > 0);
  state.glitchSparks.forEach((spark) => {
    spark.lifetime -= 16;
    spark.opacity = spark.lifetime / 200;
  });
}

function createSporeParticles(viewport: ViewportSize): SporeParticle[] {
  return Array.from({ length: SPORE_COUNT }, () => ({
    x: Math.random() * viewport.width,
    y: Math.random() * viewport.height,
    vx: (Math.random() - 0.5) * 0.12,
    vy: (Math.random() - 0.5) * 0.12,
    size: Math.random() * 1.4 + 0.6,
    opacity: Math.random() * 0.15 + 0.08,
  }));
}

function createShadowBlobs(viewport: ViewportSize): ShadowBlob[] {
  return Array.from({ length: SHADOW_COUNT }, () => ({
    x: Math.random() * viewport.width,
    y: Math.random() * viewport.height,
    vx: 0.06 + Math.random() * 0.06,
    vy: 0.06 + Math.random() * 0.06,
    size: 400 + Math.random() * 400,
    opacity: 0.12 + Math.random() * 0.15,
  }));
}

function updateSporeParticles(spores: SporeParticle[], viewport: ViewportSize): void {
  spores.forEach((spore) => {
    spore.x += spore.vx;
    spore.y += spore.vy;

    if (spore.x < 0) spore.x = viewport.width;
    if (spore.x > viewport.width) spore.x = 0;
    if (spore.y < 0) spore.y = viewport.height;
    if (spore.y > viewport.height) spore.y = 0;
  });
}

function updateShadowBlobs(shadows: ShadowBlob[], viewport: ViewportSize): void {
  shadows.forEach((shadow) => {
    shadow.x += shadow.vx;
    shadow.y += shadow.vy;

    if (shadow.x > viewport.width + shadow.size) shadow.x = -shadow.size;
    if (shadow.y > viewport.height + shadow.size) shadow.y = -shadow.size;
  });
}

function addGlitchSpark(glitchSparks: GlitchSpark[], viewport: ViewportSize): void {
  const colorIndex = Math.floor(Math.random() * GLITCH_COLORS.length);
  const color = GLITCH_COLORS[colorIndex] ?? GLITCH_COLORS[0];
  const spark: GlitchSpark = {
    x: Math.random() * viewport.width,
    y: Math.random() * viewport.height,
    opacity: 1,
    size: 2 + Math.random() * 12,
    lifetime: 180,
    color,
    shape: Math.floor(Math.random() * 2),
  };

  glitchSparks.push(spark);
}
