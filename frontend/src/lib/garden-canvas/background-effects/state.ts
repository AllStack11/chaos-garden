import type { SimulationEvent } from '../../../env.d.ts';
import type {
  BiomeCell,
  CanopyEdge,
  CanopyNode,
  GlitchSpark,
  MemoryRing,
  ParallaxBand,
  PointerPosition,
  RootPressureCell,
  ShadowBlob,
  SporeParticle,
  ViewportSize,
  RippleEffect,
} from './types.ts';
import type { QualityTier } from '../../rendering/types.ts';

const GLITCH_COLORS = [
  '255, 100, 180',
  '100, 220, 255',
  '180, 120, 255',
  '255, 200, 100',
  '100, 180, 255',
  '220, 255, 100',
];

const QUALITY_MULTIPLIERS: Record<QualityTier, number> = {
  high: 1,
  medium: 0.72,
  low: 0.45,
};

export interface BackgroundAnimationState {
  spores: SporeParticle[];
  shadows: ShadowBlob[];
  glitchSparks: GlitchSpark[];
  ripples: RippleEffect[];
  memoryRings: MemoryRing[];
  biomeCells: BiomeCell[];
  rootPressureCells: RootPressureCell[];
  parallaxBands: ParallaxBand[];
  canopyNodes: CanopyNode[];
  canopyEdges: CanopyEdge[];
  biomeDriftX: number;
  biomeDriftY: number;
  lastGlitchTime: number;
  randomSeed: number;
  qualityTier: QualityTier;
  lastEventFingerprint: string;
}

function nextRandom(state: BackgroundAnimationState): number {
  state.randomSeed = (state.randomSeed * 1664525 + 1013904223) >>> 0;
  return state.randomSeed / 4294967296;
}

function pickCount(baseCount: number, qualityTier: QualityTier): number {
  return Math.max(1, Math.floor(baseCount * QUALITY_MULTIPLIERS[qualityTier]));
}

export function createBackgroundAnimationState(
  viewport: ViewportSize,
  qualityTier: QualityTier,
): BackgroundAnimationState {
  const state: BackgroundAnimationState = {
    spores: [],
    shadows: [],
    glitchSparks: [],
    ripples: [],
    memoryRings: [],
    biomeCells: [],
    rootPressureCells: [],
    parallaxBands: [],
    canopyNodes: [],
    canopyEdges: [],
    biomeDriftX: 0,
    biomeDriftY: 0,
    lastGlitchTime: 0,
    randomSeed: ((viewport.width * 73856093) ^ (viewport.height * 19349663)) >>> 0,
    qualityTier,
    lastEventFingerprint: '',
  };

  state.spores = createSporeParticles(state, viewport);
  state.shadows = createShadowBlobs(state, viewport);
  state.biomeCells = createBiomeCells(state, viewport);
  state.rootPressureCells = createRootPressureCells(state, viewport);
  state.parallaxBands = createParallaxBands(state, viewport);
  const canopyGraph = createCanopyGraph(state, viewport);
  state.canopyNodes = canopyGraph.nodes;
  state.canopyEdges = canopyGraph.edges;
  return state;
}

export function resizeBackgroundAnimationState(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
  qualityTier: QualityTier,
): void {
  state.qualityTier = qualityTier;
  state.spores = createSporeParticles(state, viewport);
  state.shadows = createShadowBlobs(state, viewport);
  state.biomeCells = createBiomeCells(state, viewport);
  state.rootPressureCells = createRootPressureCells(state, viewport);
  state.parallaxBands = createParallaxBands(state, viewport);
  const canopyGraph = createCanopyGraph(state, viewport);
  state.canopyNodes = canopyGraph.nodes;
  state.canopyEdges = canopyGraph.edges;
}

export function syncBackgroundEventEffects(
  state: BackgroundAnimationState,
  events: SimulationEvent[],
  viewport: ViewportSize,
): void {
  const fingerprint = events
    .slice(0, 16)
    .map((event) => `${event.id ?? event.timestamp}:${event.eventType}`)
    .join('|');

  if (!fingerprint || fingerprint === state.lastEventFingerprint) {
    return;
  }

  state.lastEventFingerprint = fingerprint;

  const priorityEvents = events.filter(
    (event) =>
      event.eventType === 'REPRODUCTION' ||
      event.eventType === 'DEATH' ||
      event.eventType === 'POPULATION_EXPLOSION' ||
      event.eventType === 'POPULATION_DELTA',
  );

  priorityEvents.slice(0, 5).forEach((event) => {
    const eventType =
      event.eventType === 'REPRODUCTION'
        ? 'REPRODUCTION'
        : event.eventType === 'DEATH'
          ? 'DEATH'
          : event.eventType === 'POPULATION_DELTA'
            ? 'PREDATION'
            : 'POPULATION';

    const baseRadius = eventType === 'POPULATION' ? 220 : eventType === 'REPRODUCTION' ? 140 : 180;
    const baseOpacity = eventType === 'DEATH' ? 0.5 : 0.38;

    state.ripples.push({
      x: nextRandom(state) * viewport.width,
      y: nextRandom(state) * viewport.height,
      radius: 4,
      maxRadius: baseRadius + nextRandom(state) * 180,
      opacity: baseOpacity + nextRandom(state) * 0.25,
      eventType,
    });

    const eventKey = `${event.id ?? event.timestamp}|${event.eventType}|${event.timestamp}`;
    const deterministic = deterministicEventCoordinates(eventKey, viewport);
    const ringType =
      event.eventType === 'REPRODUCTION'
        ? 'growth'
        : event.eventType === 'DEATH'
          ? 'decay'
          : event.eventType === 'POPULATION_DELTA'
            ? 'stress'
            : 'population';

    state.memoryRings.push({
      x: deterministic.x,
      y: deterministic.y,
      radius: 8,
      maxRadius: (ringType === 'population' ? 280 : ringType === 'growth' ? 200 : 230) + (deterministic.seed % 60),
      opacity: ringType === 'decay' ? 0.32 : 0.28,
      age: 0,
      maxAge: ringType === 'population' ? 2600 : 2200,
      ringType,
    });
  });

  // Keep recent ring history bounded
  const maxRingHistory = 42;
  if (state.memoryRings.length > maxRingHistory) {
    state.memoryRings.splice(0, state.memoryRings.length - maxRingHistory);
  }
}

export function updateBackgroundAnimationState(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
  mousePos: PointerPosition,
  targetMousePos: PointerPosition,
  now: number,
  qualityTier: QualityTier,
): void {
  state.qualityTier = qualityTier;

  mousePos.x += (targetMousePos.x - mousePos.x) * 0.05;
  mousePos.y += (targetMousePos.y - mousePos.y) * 0.05;

  state.biomeDriftX += 0.08 * QUALITY_MULTIPLIERS[qualityTier];
  state.biomeDriftY += 0.04 * QUALITY_MULTIPLIERS[qualityTier];

  updateSporeParticles(state.spores, viewport);
  updateShadowBlobs(state.shadows, viewport);
  updateParallaxBands(state.parallaxBands);

  const glitchCadenceMs = 2200 / QUALITY_MULTIPLIERS[qualityTier];
  if (now - state.lastGlitchTime > glitchCadenceMs + nextRandom(state) * 5000) {
    addGlitchSpark(state, viewport);
    state.lastGlitchTime = now;
  }

  state.glitchSparks = state.glitchSparks.filter((spark) => spark.lifetime > 0);
  state.glitchSparks.forEach((spark) => {
    spark.lifetime -= 16;
    spark.opacity = spark.lifetime / 220;
  });

  state.ripples = state.ripples.filter((ripple) => ripple.opacity > 0.01 && ripple.radius < ripple.maxRadius);
  state.ripples.forEach((ripple) => {
    ripple.radius += 1.8;
    ripple.opacity *= 0.97;
  });

  state.memoryRings = state.memoryRings.filter((ring) => ring.age < ring.maxAge && ring.opacity > 0.005);
  state.memoryRings.forEach((ring) => {
    ring.age += 16;
    ring.radius += 0.85;
    ring.opacity *= ring.ringType === 'population' ? 0.992 : 0.989;
  });
}

function createSporeParticles(state: BackgroundAnimationState, viewport: ViewportSize): SporeParticle[] {
  const count = pickCount(80, state.qualityTier);
  return Array.from({ length: count }, () => ({
    x: nextRandom(state) * viewport.width,
    y: nextRandom(state) * viewport.height,
    vx: (nextRandom(state) - 0.5) * 0.14,
    vy: (nextRandom(state) - 0.5) * 0.14,
    size: nextRandom(state) * 1.6 + 0.5,
    opacity: nextRandom(state) * 0.14 + 0.08,
    depth: nextRandom(state),
  }));
}

function createShadowBlobs(state: BackgroundAnimationState, viewport: ViewportSize): ShadowBlob[] {
  const count = pickCount(10, state.qualityTier);
  return Array.from({ length: count }, () => ({
    x: nextRandom(state) * viewport.width,
    y: nextRandom(state) * viewport.height,
    vx: 0.04 + nextRandom(state) * 0.08,
    vy: 0.04 + nextRandom(state) * 0.08,
    size: 340 + nextRandom(state) * 500,
    opacity: 0.1 + nextRandom(state) * 0.16,
  }));
}

function createBiomeCells(state: BackgroundAnimationState, viewport: ViewportSize): BiomeCell[] {
  const cellSize = state.qualityTier === 'high' ? 90 : state.qualityTier === 'medium' ? 130 : 170;
  const cols = Math.ceil(viewport.width / cellSize) + 2;
  const rows = Math.ceil(viewport.height / cellSize) + 2;
  const cells: BiomeCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({
        x: (col - 1) * cellSize,
        y: (row - 1) * cellSize,
        size: cellSize,
        moisture: nextRandom(state),
        fertility: nextRandom(state),
        corruption: nextRandom(state) * 0.7,
      });
    }
  }

  return cells;
}

function createRootPressureCells(state: BackgroundAnimationState, viewport: ViewportSize): RootPressureCell[] {
  const cellSize = state.qualityTier === 'high' ? 120 : state.qualityTier === 'medium' ? 150 : 190;
  const cols = Math.ceil(viewport.width / cellSize) + 2;
  const rows = Math.ceil(viewport.height / cellSize) + 2;
  const cells: RootPressureCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({
        x: (col - 1) * cellSize,
        y: (row - 1) * cellSize,
        size: cellSize,
        pressure: 0.2 + nextRandom(state) * 0.8,
        tilt: (nextRandom(state) - 0.5) * 0.6,
      });
    }
  }

  return cells;
}

function createParallaxBands(state: BackgroundAnimationState, viewport: ViewportSize): ParallaxBand[] {
  const bandCount = state.qualityTier === 'high' ? 8 : state.qualityTier === 'medium' ? 6 : 4;

  return Array.from({ length: bandCount }, (_, index) => ({
    baseY: viewport.height * (0.12 + index / (bandCount + 3)),
    amplitude: 6 + nextRandom(state) * 16,
    wavelength: 190 + nextRandom(state) * 300,
    phase: nextRandom(state) * Math.PI * 2,
    speed: 0.0007 + nextRandom(state) * 0.0018,
    opacity: 0.014 + nextRandom(state) * 0.026,
    thickness: 0.7 + nextRandom(state) * 1.1,
    hue: 95 + nextRandom(state) * 60,
    depth: index / Math.max(1, bandCount - 1),
  }));
}

function createCanopyGraph(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
): { nodes: CanopyNode[]; edges: CanopyEdge[] } {
  const nodeCount = state.qualityTier === 'high' ? 72 : state.qualityTier === 'medium' ? 54 : 36;
  const nodes: CanopyNode[] = [];
  const edges: CanopyEdge[] = [];

  for (let index = 0; index < nodeCount; index += 1) {
    const x = nextRandom(state) * viewport.width;
    const y = (nextRandom(state) * viewport.height * 0.72) + viewport.height * 0.02;
    nodes.push({
      id: index,
      x,
      y,
      depth: nextRandom(state),
    });
  }

  nodes.sort((left, right) => left.y - right.y);

  for (let index = 1; index < nodes.length; index += 1) {
    const child = nodes[index]!;
    let bestParent = nodes[0]!;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let parentIndex = 0; parentIndex < index; parentIndex += 1) {
      const parent = nodes[parentIndex]!;
      const dx = child.x - parent.x;
      const dy = child.y - parent.y;
      if (dy <= 0) continue;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const score = distance * (0.8 + parent.depth * 0.4);
      if (score < bestScore) {
        bestScore = score;
        bestParent = parent;
      }
    }

    edges.push({
      fromId: bestParent.id,
      toId: child.id,
      thickness: 0.4 + nextRandom(state) * 1.6,
      curve: (nextRandom(state) - 0.5) * 40,
      weight: 0.4 + nextRandom(state) * 0.6,
    });
  }

  return { nodes, edges };
}

function updateSporeParticles(spores: SporeParticle[], viewport: ViewportSize): void {
  spores.forEach((spore) => {
    spore.x += spore.vx * (0.6 + spore.depth * 0.8);
    spore.y += spore.vy * (0.6 + spore.depth * 0.8);

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

function updateParallaxBands(parallaxBands: ParallaxBand[]): void {
  parallaxBands.forEach((band) => {
    band.phase += band.speed;
    if (band.phase > Math.PI * 2) {
      band.phase -= Math.PI * 2;
    }
  });
}

function addGlitchSpark(state: BackgroundAnimationState, viewport: ViewportSize): void {
  const colorIndex = Math.floor(nextRandom(state) * GLITCH_COLORS.length);
  const color = GLITCH_COLORS[colorIndex] ?? GLITCH_COLORS[0];

  state.glitchSparks.push({
    x: nextRandom(state) * viewport.width,
    y: nextRandom(state) * viewport.height,
    opacity: 1,
    size: 2 + nextRandom(state) * 10,
    lifetime: 180,
    color,
    shape: Math.floor(nextRandom(state) * 2),
  });
}

function deterministicEventCoordinates(
  eventKey: string,
  viewport: ViewportSize,
): { x: number; y: number; seed: number } {
  let hash = 2166136261;
  for (let index = 0; index < eventKey.length; index += 1) {
    hash ^= eventKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const seed = hash >>> 0;
  const x = ((seed % 100000) / 100000) * viewport.width;
  const y = ((((seed / 101) % 100000) / 100000) * viewport.height * 0.72) + viewport.height * 0.08;
  return { x, y, seed };
}
