import type { SimulationEvent } from '../../../env.d.ts';
import type {
  BiomeCell,
  CanopyEdge,
  CanopyNode,
  FogPatch,
  GlitchSpark,
  MemoryRing,
  ParallaxBand,
  PointerPosition,
  RainDropParticle,
  RootPressureCell,
  ShadowBlob,
  SporeParticle,
  ViewportSize,
  RippleEffect,
  FireflyParticle,
  Star,
  GodRay,
  AuroraWave,
  WindLeaf,
  PollenParticle,
  MistLayer,
  Dewdrop,
  DustDevil,
  FlowerBloom,
  MushroomSprite,
  SeasonalGroundParticle,
  Puddle,
  Footprint,
  BackgroundWorldState,
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
  rainDrops: RainDropParticle[];
  fogPatches: FogPatch[];
  currentWeatherStateName: string | null;
  biomeDriftX: number;
  biomeDriftY: number;
  lastGlitchTime: number;
  lastLightningTime: number;
  lastDustDevilTime: number;
  lightningOpacity: number;
  randomSeed: number;
  qualityTier: QualityTier;
  lastEventFingerprint: string;
  // New visual enhancements
  fireflies: FireflyParticle[];
  stars: Star[];
  godRays: GodRay[];
  auroraWaves: AuroraWave[];
  auroraActive: boolean;
  auroraIntensity: number;
  windLeaves: WindLeaf[];
  pollen: PollenParticle[];
  mistLayers: MistLayer[];
  dewdrops: Dewdrop[];
  dustDevils: DustDevil[];
  flowerBlooms: FlowerBloom[];
  mushrooms: MushroomSprite[];
  seasonalGround: SeasonalGroundParticle[];
  puddles: Puddle[];
  footprints: Footprint[];
  lastSunDirection: number;
  lastTemperatureZone: string;
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
    rainDrops: [],
    fogPatches: [],
    currentWeatherStateName: null,
    biomeDriftX: 0,
    biomeDriftY: 0,
    lastGlitchTime: 0,
    lastLightningTime: 0,
    lastDustDevilTime: 0,
    lightningOpacity: 0,
    randomSeed: ((viewport.width * 73856093) ^ (viewport.height * 19349663)) >>> 0,
    qualityTier,
    lastEventFingerprint: '',
    // New visual enhancements
    fireflies: [],
    stars: [],
    godRays: [],
    auroraWaves: [],
    auroraActive: false,
    auroraIntensity: 0,
    windLeaves: [],
    pollen: [],
    mistLayers: [],
    dewdrops: [],
    dustDevils: [],
    flowerBlooms: [],
    mushrooms: [],
    seasonalGround: [],
    puddles: [],
    footprints: [],
    lastSunDirection: 0,
    lastTemperatureZone: 'normal',
  };

  state.spores = createSporeParticles(state, viewport);
  state.shadows = createShadowBlobs(state, viewport);
  state.biomeCells = createBiomeCells(state, viewport);
  state.rootPressureCells = createRootPressureCells(state, viewport);
  state.parallaxBands = createParallaxBands(state, viewport);
  const canopyGraph = createCanopyGraph(state, viewport);
  state.canopyNodes = canopyGraph.nodes;
  state.canopyEdges = canopyGraph.edges;

  // Initialize new visual effects
  state.stars = createStars(state, viewport);
  state.windLeaves = []; // Start empty, will spawn occasionally
  state.godRays = createGodRays(state, viewport, state.lastSunDirection);

  return state;
}

export function resizeBackgroundAnimationState(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
  qualityTier: QualityTier,
): void {
  const oldWidth = state.spores.length > 0 ? viewport.width : 0;
  const oldHeight = state.spores.length > 0 ? viewport.height : 0;
  
  state.qualityTier = qualityTier;

  // If we have existing state, try to scale/preserve it instead of regenerating
  if (state.spores.length > 0 && oldWidth > 0 && oldHeight > 0) {
    const scaleX = viewport.width / oldWidth;
    const scaleY = viewport.height / oldHeight;

    // Scale spores
    state.spores.forEach(s => {
      s.x *= scaleX;
      s.y *= scaleY;
    });

    // Scale shadows
    state.shadows.forEach(s => {
      s.x *= scaleX;
      s.y *= scaleY;
    });

    // Scale canopy nodes
    state.canopyNodes.forEach(n => {
      n.x *= scaleX;
      n.y *= scaleY;
    });

    // Scale stars
    state.stars.forEach(s => {
      s.x *= scaleX;
      s.y *= scaleY;
    });

    // Scale fireflies
    state.fireflies.forEach(f => {
      f.x *= scaleX;
      f.y *= scaleY;
    });

    // Scale wind leaves
    state.windLeaves.forEach(l => {
      l.x *= scaleX;
      l.y *= scaleY;
    });

    // Scale pollen
    state.pollen.forEach(p => {
      p.x *= scaleX;
      p.y *= scaleY;
    });

    // Scale mist layers
    state.mistLayers.forEach(m => {
      m.x *= scaleX;
      m.y *= scaleY;
      m.width *= scaleX;
      m.height *= scaleY;
    });

    // Scale dewdrops
    state.dewdrops.forEach(d => {
      d.x *= scaleX;
      d.y *= scaleY;
    });

    // Scale glitch sparks
    state.glitchSparks.forEach(s => {
      s.x *= scaleX;
      s.y *= scaleY;
    });

    // Scale ripples
    state.ripples.forEach(r => {
      r.x *= scaleX;
      r.y *= scaleY;
    });

    // Scale memory rings
    state.memoryRings.forEach(r => {
      r.x *= scaleX;
      r.y *= scaleY;
    });

    // Scale fog patches
    state.fogPatches.forEach(f => {
      f.x *= scaleX;
      f.y *= scaleY;
    });

    // Scale rain drops
    state.rainDrops.forEach(r => {
      r.x *= scaleX;
      r.y *= scaleY;
    });

    // Scale god rays
    state.godRays.forEach(r => {
      r.originX *= scaleX;
      r.originY *= scaleY;
    });

    // Scale aurora waves
    state.auroraWaves.forEach(w => {
      w.baseY *= scaleY;
    });

    // Scale dust devils
    state.dustDevils.forEach(d => {
      d.x *= scaleX;
      d.y *= scaleY;
    });

    // Parallax bands just need their baseY updated
    state.parallaxBands.forEach(b => {
      b.baseY *= scaleY;
    });

    // Note: Grid-based systems (biomes, root pressure) are easier to regenerate 
    // but they are static relative to their grid coordinates, so it's less jarring.
    // However, to be fully safe we regenerate them.
    state.biomeCells = createBiomeCells(state, viewport);
    state.rootPressureCells = createRootPressureCells(state, viewport);
  } else {
    // Initial creation or fallback
    state.spores = createSporeParticles(state, viewport);
    state.shadows = createShadowBlobs(state, viewport);
    state.biomeCells = createBiomeCells(state, viewport);
    state.rootPressureCells = createRootPressureCells(state, viewport);
    state.parallaxBands = createParallaxBands(state, viewport);
    const canopyGraph = createCanopyGraph(state, viewport);
    state.canopyNodes = canopyGraph.nodes;
    state.canopyEdges = canopyGraph.edges;
    state.stars = createStars(state, viewport);
  }
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
  worldState?: BackgroundWorldState,
  timePhase?: string,
): void {
  state.qualityTier = qualityTier;

  mousePos.x += (targetMousePos.x - mousePos.x) * 0.05;
  mousePos.y += (targetMousePos.y - mousePos.y) * 0.05;

  state.biomeDriftX += 0.015 * QUALITY_MULTIPLIERS[qualityTier];
  state.biomeDriftY += 0.008 * QUALITY_MULTIPLIERS[qualityTier];

  updateSporeParticles(state.spores, viewport);
  updateShadowBlobs(state.shadows, viewport);
  updateParallaxBands(state.parallaxBands);
  if (state.rainDrops.length > 0) updateRainDropParticles(state.rainDrops, viewport);
  if (state.fogPatches.length > 0) updateFogPatchPositions(state.fogPatches, viewport);

  // Update new visual enhancements
  if (state.stars.length > 0) updateStars(state.stars);

  // Fireflies - spawn at dusk/night, fade at dawn
  if (timePhase === 'dusk' && state.fireflies.length === 0) {
    state.fireflies = createFireflyParticles(state, viewport);
  } else if (timePhase === 'day' && state.fireflies.length > 0) {
    state.fireflies = []; // Clear during day
  }
  if (state.fireflies.length > 0) {
    updateFireflyParticles(state.fireflies, viewport, timePhase ?? 'night');
    // Remove fireflies with very low opacity
    state.fireflies = state.fireflies.filter(f => f.baseOpacity > 0.05);
  }

  // Wind leaves - Spawn occasionally as "gusts" rather than being persistent
  // Chance per frame to start a small gust of leaves (about 0.2% chance = roughly every 8-10 seconds)
  const isStormy = state.currentWeatherStateName === 'STORM';
  const spawnChance = isStormy ? 0.008 : 0.0015;

  if (nextRandom(state) < spawnChance && state.windLeaves.length < 15) {
    const gustLeaves = createWindLeaves(state, viewport, isStormy ? 2.0 : 1.0);
    state.windLeaves.push(...gustLeaves);
  }

  if (state.windLeaves.length > 0) {
    const windStrength = isStormy ? 2.5 : state.currentWeatherStateName === 'RAIN' ? 1.5 : 1.0;
    updateWindLeaves(state.windLeaves, viewport, windStrength);

    // Fade out leaves that are near the bottom or have been around too long
    state.windLeaves.forEach(leaf => {
      if (leaf.y > viewport.height * 0.8) {
        leaf.opacity *= 0.96;
      }
    });

    // Remove invisible leaves
    state.windLeaves = state.windLeaves.filter(leaf => leaf.opacity > 0.01);
  }

  // Pollen - spawn during day with high plant density
  if (timePhase === 'day' && worldState && (worldState.plantDensity ?? 0) > 0.2) {
    if (state.pollen.length === 0) {
      state.pollen = createPollenParticles(state, viewport, worldState.plantDensity ?? 0);
    }
  } else if (timePhase !== 'day' && state.pollen.length > 0) {
    state.pollen = []; // Clear at night
  }
  if (state.pollen.length > 0) updatePollenParticles(state.pollen, viewport);

  // Mist layers - spawn at dusk/night with high moisture
  if ((timePhase === 'dusk' || timePhase === 'night') && worldState && (worldState.moisture ?? 0) > 0.5) {
    if (state.mistLayers.length === 0) {
      state.mistLayers = createMistLayers(state, viewport);
    }
  } else if (timePhase === 'day' && state.mistLayers.length > 0) {
    state.mistLayers = []; // Clear during day
  }
  if (state.mistLayers.length > 0) updateMistLayers(state.mistLayers, viewport);

  // Dewdrops - spawn at dawn with high moisture
  if (timePhase === 'dawn' && worldState && (worldState.moisture ?? 0) > 0.6) {
    if (state.dewdrops.length === 0) {
      state.dewdrops = createDewdrops(state, viewport);
    }
  } else if (timePhase !== 'dawn' && state.dewdrops.length > 0) {
    state.dewdrops = []; // Clear after dawn
  }
  if (state.dewdrops.length > 0) updateDewdrops(state.dewdrops);

  // God rays - recreate when sun direction changes significantly
  if (worldState) {
    const sunDirection = Math.PI * 2 * ((worldState.tick % 96) / 96);
    const directionChange = Math.abs(sunDirection - state.lastSunDirection);

    if (directionChange > 0.3 || state.godRays.length === 0) {
      state.godRays = createGodRays(state, viewport, sunDirection);
      state.lastSunDirection = sunDirection;
    }
  }

  // Aurora borealis - rare night event in cold temperatures
  if (worldState && timePhase === 'night' && (worldState.temperature ?? 20) < 10) {
    // Trigger aurora with 0.02% chance per frame (rare)
    if (!state.auroraActive && nextRandom(state) < 0.0002) {
      state.auroraActive = true;
      state.auroraIntensity = 0;
      state.auroraWaves = createAuroraWaves(state, viewport);
    }
  }

  // Manage aurora fade in/out
  if (state.auroraActive) {
    if (state.auroraIntensity >= 0) {
      // Fading in
      state.auroraIntensity += 0.005;
      if (state.auroraIntensity >= 1) {
        state.auroraIntensity = 1;
        // 0.1% chance to start fading out after reaching full intensity
        if (nextRandom(state) < 0.001) {
          state.auroraIntensity = -0.01; // Negative signals fade out
        }
      }
    } else {
      // Fading out
      state.auroraIntensity -= 0.005;
      if (state.auroraIntensity <= -1) {
        state.auroraActive = false;
        state.auroraIntensity = 0;
        state.auroraWaves = [];
      }
    }

    // Animate waves
    if (state.auroraWaves.length > 0) {
      updateAuroraWaves(state.auroraWaves);
    }
  }

  // Dust devils - spawn during hot, dry daytime conditions
  if (worldState && timePhase === 'day' && (worldState.temperature ?? 20) > 28 && (worldState.moisture ?? 0.5) < 0.3) {
    // Rare spawn with cooldown (0.1% chance, 8s cooldown)
    if (now - state.lastDustDevilTime > 8000 && nextRandom(state) < 0.001) {
      state.dustDevils.push(createDustDevil(state, viewport));
      state.lastDustDevilTime = now;
    }
  }

  // Update and clean up dust devils
  if (state.dustDevils.length > 0) {
    updateDustDevils(state.dustDevils, viewport);
    state.dustDevils = state.dustDevils.filter(dd => dd.lifetime < dd.maxLifetime);
  }

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

  // Weather-specific state updates
  if (state.currentWeatherStateName === 'STORM') {
    if (now - state.lastLightningTime > 3000 + nextRandom(state) * 8000) {
      state.lightningOpacity = 0.4 + nextRandom(state) * 0.4;
      state.lastLightningTime = now;
    }
  }

  if (state.lightningOpacity > 0) {
    state.lightningOpacity *= 0.88;
    if (state.lightningOpacity < 0.01) state.lightningOpacity = 0;
  }
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
      const baseX = (col - 1) * cellSize;
      const baseY = (row - 1) * cellSize;

      // Add organic variation
      const tilt = (nextRandom(state) - 0.5) * 0.8;
      const offsetX = (nextRandom(state) - 0.5) * cellSize * 0.15;
      const offsetY = (nextRandom(state) - 0.5) * cellSize * 0.15;

      // Create ellipse with slight variation in aspect ratio
      const sizeVariation = 0.85 + nextRandom(state) * 0.3;
      const aspectRatio = 0.6 + nextRandom(state) * 0.5;
      const radiusX = (cellSize * sizeVariation) * 0.5;
      const radiusY = radiusX * aspectRatio;

      // Random shape type (0-4) and curve variation for organic blobs
      const shapeType = Math.floor(nextRandom(state) * 5);
      const curveVariation = nextRandom(state);

      cells.push({
        x: baseX,
        y: baseY,
        size: cellSize,
        moisture: nextRandom(state),
        fertility: nextRandom(state),
        corruption: nextRandom(state) * 0.7,
        tilt,
        radiusX,
        radiusY,
        offsetX,
        offsetY,
        shapeType,
        curveVariation,
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

// ==========================================
// Weather Particle Management
// ==========================================

export function syncWeatherParticlesToBackgroundState(
  state: BackgroundAnimationState,
  weatherStateName: string | null,
  viewport: ViewportSize,
): void {
  if (weatherStateName === state.currentWeatherStateName) return;
  state.currentWeatherStateName = weatherStateName;

  // Rebuild rain drops based on weather
  if (weatherStateName === 'STORM') {
    state.rainDrops = createRainDropParticles(state, viewport, pickCount(600, state.qualityTier));
  } else if (weatherStateName === 'RAIN') {
    state.rainDrops = createRainDropParticles(state, viewport, pickCount(250, state.qualityTier));
  } else {
    state.rainDrops = [];
  }

  // Rebuild fog patches based on weather
  if (weatherStateName === 'FOG') {
    state.fogPatches = createFogPatches(state, viewport, pickCount(24, state.qualityTier));
  } else if (weatherStateName === 'STORM') {
    state.fogPatches = createFogPatches(state, viewport, pickCount(12, state.qualityTier));
  } else {
    state.fogPatches = [];
  }
}

function createRainDropParticles(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
  count: number,
): RainDropParticle[] {
  return Array.from({ length: count }, () => ({
    x: nextRandom(state) * viewport.width,
    y: nextRandom(state) * viewport.height,
    velocity: 6 + nextRandom(state) * 8,
    length: 8 + nextRandom(state) * 16,
    opacity: 0.15 + nextRandom(state) * 0.25,
    windOffset: (nextRandom(state) - 0.3) * 2.5,
  }));
}

function createFogPatches(
  state: BackgroundAnimationState,
  viewport: ViewportSize,
  count: number,
): FogPatch[] {
  return Array.from({ length: count }, () => ({
    x: nextRandom(state) * viewport.width,
    y: nextRandom(state) * viewport.height,
    radius: 120 + nextRandom(state) * 250,
    opacity: 0.04 + nextRandom(state) * 0.08,
    driftSpeed: 0.1 + nextRandom(state) * 0.25,
    driftAngle: nextRandom(state) * Math.PI * 2,
  }));
}

function updateRainDropParticles(rainDrops: RainDropParticle[], viewport: ViewportSize): void {
  rainDrops.forEach((drop) => {
    drop.y += drop.velocity;
    drop.x += drop.windOffset;

    if (drop.y > viewport.height) {
      drop.y = -drop.length;
      drop.x = Math.random() * viewport.width;
    }
    if (drop.x < 0) drop.x = viewport.width;
    if (drop.x > viewport.width) drop.x = 0;
  });
}

function updateFogPatchPositions(fogPatches: FogPatch[], viewport: ViewportSize): void {
  fogPatches.forEach((patch) => {
    patch.x += Math.cos(patch.driftAngle) * patch.driftSpeed;
    patch.y += Math.sin(patch.driftAngle) * patch.driftSpeed;

    // Slowly rotate drift direction
    patch.driftAngle += (Math.random() - 0.5) * 0.02;

    // Wrap around viewport
    if (patch.x < -patch.radius) patch.x = viewport.width + patch.radius;
    if (patch.x > viewport.width + patch.radius) patch.x = -patch.radius;
    if (patch.y < -patch.radius) patch.y = viewport.height + patch.radius;
    if (patch.y > viewport.height + patch.radius) patch.y = -patch.radius;
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

// ============================================================================
// New Visual Enhancement Functions
// ============================================================================

// Stars - Twinkling night sky effect with fixed seeded positions for consistency
// Only visible during night time phase, fade out with fog
// Size distribution: 60% small, 30% medium, 10% large (with glow)
// Quality tiers: High: 200, Medium: 144, Low: 90
function createStars(state: BackgroundAnimationState, viewport: ViewportSize): Star[] {
  const count = pickCount(200, state.qualityTier);
  const stars: Star[] = [];

  for (let i = 0; i < count; i++) {
    const sizeRandom = nextRandom(state);
    stars.push({
      x: nextRandom(state) * viewport.width,
      y: nextRandom(state) * viewport.height * 0.4, // Upper 40% only
      brightness: 0.3 + nextRandom(state) * 0.7,
      twinklePhase: nextRandom(state) * Math.PI * 2,
      twinkleSpeed: 0.02 + nextRandom(state) * 0.04,
      size: sizeRandom < 0.6 ? 0.5 + nextRandom(state) * 0.3 : // 60% small
            sizeRandom < 0.9 ? 0.8 + nextRandom(state) * 0.4 : // 30% medium
            1.2 + nextRandom(state) * 0.3, // 10% large
    });
  }

  return stars;
}

// Update stars - Advance twinkle animation phase for each star
// Simple sine wave makes them appear to twinkle naturally
function updateStars(stars: Star[]): void {
  stars.forEach(star => {
    star.twinklePhase += star.twinkleSpeed;
    if (star.twinklePhase > Math.PI * 2) star.twinklePhase -= Math.PI * 2;
  });
}

// Fireflies - Glowing insects that float gently at dusk and night
// Spawn at dusk, fade out at dawn. Pulsing sine wave glow effect with radial halo
// Prefer mid-air heights, gentle floating movement with sine wave bobbing
// Quality tiers: High: 40, Medium: 28, Low: 18
function createFireflyParticles(state: BackgroundAnimationState, viewport: ViewportSize): FireflyParticle[] {
  const count = pickCount(40, state.qualityTier);
  const fireflies: FireflyParticle[] = [];

  for (let i = 0; i < count; i++) {
    fireflies.push({
      x: nextRandom(state) * viewport.width,
      y: nextRandom(state) * viewport.height,
      vx: (nextRandom(state) - 0.5) * 0.3,
      vy: (nextRandom(state) - 0.5) * 0.3,
      glowPhase: nextRandom(state) * Math.PI * 2,
      glowSpeed: 0.03 + nextRandom(state) * 0.05,
      baseOpacity: 0.6 + nextRandom(state) * 0.4,
      size: 1.5 + nextRandom(state) * 1,
      height: 0.2 + nextRandom(state) * 0.6, // Prefer mid-air (0.2-0.8)
    });
  }

  return fireflies;
}

// Update fireflies - Handle glow animation, floating movement, and dawn fade-out
// Glow phase advances for pulsing effect
// Floating behavior uses sine wave for natural bobbing motion
// Random velocity changes create erratic flight patterns
// Fade out gradually at dawn, removed when opacity < 0.05 in main update loop
function updateFireflyParticles(fireflies: FireflyParticle[], viewport: ViewportSize, timePhase: string): void {
  fireflies.forEach(firefly => {
    // Advance glow phase
    firefly.glowPhase += firefly.glowSpeed;
    if (firefly.glowPhase > Math.PI * 2) firefly.glowPhase -= Math.PI * 2;

    // Floating behavior with sine wave
    const floatOffset = Math.sin(firefly.glowPhase * 0.5) * 0.1;
    firefly.vx += (Math.random() - 0.5) * 0.02;
    firefly.vy += floatOffset;

    // Clamp velocity
    firefly.vx = Math.max(-0.15, Math.min(0.15, firefly.vx));
    firefly.vy = Math.max(-0.15, Math.min(0.15, firefly.vy));

    // Update position
    firefly.x += firefly.vx;
    firefly.y += firefly.vy;

    // Wrap around viewport
    if (firefly.x < 0) firefly.x = viewport.width;
    if (firefly.x > viewport.width) firefly.x = 0;
    if (firefly.y < 0) firefly.y = viewport.height;
    if (firefly.y > viewport.height) firefly.y = 0;

    // Fade out at dawn
    if (timePhase === 'dawn') {
      firefly.baseOpacity *= 0.95;
    }
  });
}

// Wind Leaves - Drifting foliage particles that fall and tumble with the wind
// Color varies with temperature: cold = yellow/orange (autumn), warm = green/pink (spring)
// Small batches for occasional gusts
function createWindLeaves(state: BackgroundAnimationState, viewport: ViewportSize, windStrength: number): WindLeaf[] {
  const count = pickCount(6, state.qualityTier); // High: 6, Medium: 4, Low: 2
  const leaves: WindLeaf[] = [];

  for (let i = 0; i < count; i++) {
    const colors: ('green' | 'yellow' | 'orange' | 'pink')[] = ['green', 'yellow', 'orange', 'pink'];
    leaves.push({
      x: nextRandom(state) * viewport.width,
      y: nextRandom(state) * viewport.height,
      vx: (nextRandom(state) - 0.3) * 1.5 * windStrength,
      vy: nextRandom(state) * 0.8 + 0.2,
      rotation: nextRandom(state) * Math.PI * 2,
      rotationSpeed: (nextRandom(state) - 0.5) * 0.08,
      size: 2 + nextRandom(state) * 3,
      color: colors[Math.floor(nextRandom(state) * colors.length)],
      opacity: 0.5 + nextRandom(state) * 0.5,
      depth: nextRandom(state),
    });
  }

  return leaves;
}

// Update wind leaves - Rotate and move leaves based on wind strength
// Wind strength varies by weather: STORM = 2.5x, RAIN = 1.5x, normal = 1.0x
// Horizontal movement affected by wind, vertical is constant downward drift
// Wrap around sides but do NOT respawn at top (they fade out instead)
function updateWindLeaves(leaves: WindLeaf[], viewport: ViewportSize, windStrength: number): void {
  leaves.forEach(leaf => {
    leaf.rotation += leaf.rotationSpeed;
    leaf.x += leaf.vx * windStrength;
    leaf.y += leaf.vy;

    // Wrap sides
    if (leaf.x < -20) leaf.x = viewport.width + 20;
    if (leaf.x > viewport.width + 20) leaf.x = -20;
  });
}

// Pollen - Yellow/golden particles drifting from plants during daytime
// Only active during day phase when plant density > 0.2
// Spawns in bottom half (where plants are), gentle upward drift with clustering behavior
// Count scales dynamically with plant density (higher density = more pollen)
function createPollenParticles(state: BackgroundAnimationState, viewport: ViewportSize, plantDensity: number): PollenParticle[] {
  const count = Math.floor(plantDensity * 80 * QUALITY_MULTIPLIERS[state.qualityTier]);
  const pollen: PollenParticle[] = [];

  for (let i = 0; i < count; i++) {
    pollen.push({
      x: nextRandom(state) * viewport.width,
      y: viewport.height * 0.5 + nextRandom(state) * viewport.height * 0.5, // Bottom half
      vx: (nextRandom(state) - 0.5) * 0.4,
      vy: -0.1 - nextRandom(state) * 0.2, // Upward drift
      size: 0.8 + nextRandom(state) * 0.8,
      opacity: 0.3 + nextRandom(state) * 0.4,
      clusterPhase: nextRandom(state) * Math.PI * 2,
    });
  }

  return pollen;
}

// Update pollen particles - Drift upward with gentle horizontal swaying
// Cluster phase creates sine wave horizontal movement for natural drifting appearance
// Particles float upward (negative vy) and reset at top, simulating continuous release from plants
function updatePollenParticles(pollen: PollenParticle[], viewport: ViewportSize): void {
  pollen.forEach(particle => {
    particle.clusterPhase += 0.02;
    particle.x += particle.vx + Math.sin(particle.clusterPhase) * 0.2;
    particle.y += particle.vy;

    // Reset when out of bounds
    if (particle.y < -20) {
      particle.y = viewport.height + 20;
      particle.x = Math.random() * viewport.width;
    }
    if (particle.x < -20) particle.x = viewport.width + 20;
    if (particle.x > viewport.width + 20) particle.x = -20;
  });
}

// Mist Layers - Ground-hugging fog that forms at dawn and night
// Only active when moisture > 0.5. Burns off gradually during dawn as sunlight increases
// Low altitude (0-0.3) keeps it near the ground, slow horizontal drift
// Enhanced during FOG weather state
// Quality tiers: High: 12, Medium: 8, Low: 5
function createMistLayers(state: BackgroundAnimationState, viewport: ViewportSize): MistLayer[] {
  const count = pickCount(12, state.qualityTier);
  const mist: MistLayer[] = [];

  for (let i = 0; i < count; i++) {
    const altitude = nextRandom(state) * 0.3; // 0-0.3 (ground level)
    mist.push({
      x: nextRandom(state) * viewport.width - 100,
      y: viewport.height * (0.6 + altitude * 0.3),
      width: 150 + nextRandom(state) * 250,
      height: 40 + nextRandom(state) * 60,
      opacity: 0.15 + nextRandom(state) * 0.15,
      driftSpeed: 0.05 + nextRandom(state) * 0.1,
      altitude,
    });
  }

  return mist;
}

// Update mist layers - Slow horizontal drift, wrap around when reaching edge
// Creates illusion of fog banks moving across the landscape
function updateMistLayers(mist: MistLayer[], viewport: ViewportSize): void {
  mist.forEach(layer => {
    layer.x += layer.driftSpeed;
    if (layer.x > viewport.width + 100) {
      layer.x = -layer.width - 100;
    }
  });
}

// Dewdrops - Sparkling water droplets on foliage that catch the morning light
// Only active during dawn when moisture > 0.6. Fade as sun rises
// Fixed positions (seeded) in lower 70% of viewport where grass/plants would be
// Rainbow sparkle effect with pulsing brightness
// Quality tiers: High: 80, Medium: 57, Low: 36
function createDewdrops(state: BackgroundAnimationState, viewport: ViewportSize): Dewdrop[] {
  const count = pickCount(80, state.qualityTier);
  const dewdrops: Dewdrop[] = [];

  for (let i = 0; i < count; i++) {
    dewdrops.push({
      x: nextRandom(state) * viewport.width,
      y: viewport.height * 0.3 + nextRandom(state) * viewport.height * 0.7, // Lower 70%
      sparklePhase: nextRandom(state) * Math.PI * 2,
      sparkleSpeed: 0.03 + nextRandom(state) * 0.05,
      size: 1 + nextRandom(state) * 1.5,
    });
  }

  return dewdrops;
}

// Update dewdrops - Advance sparkle animation phase for twinkling effect
// Sine wave creates natural shimmer/glimmer appearance
function updateDewdrops(dewdrops: Dewdrop[]): void {
  dewdrops.forEach(drop => {
    drop.sparklePhase += drop.sparkleSpeed;
    if (drop.sparklePhase > Math.PI * 2) drop.sparklePhase -= Math.PI * 2;
  });
}

// God Rays - Volumetric light shafts emanating from the sun
// Active during day/dawn/dusk, position follows sun direction from tick cycle
// Recreate when sun direction changes significantly (> 0.3 radians)
// Quality tiers: High: 8, Medium: 5, Low: 3
function createGodRays(state: BackgroundAnimationState, viewport: ViewportSize, sunDirection: number): GodRay[] {
  const count = pickCount(8, state.qualityTier);
  const rays: GodRay[] = [];

  // Sun position based on direction (0-2π over 96 ticks)
  const sunX = viewport.width * (0.5 + Math.cos(sunDirection) * 0.4);
  const sunY = -100; // Above viewport

  for (let i = 0; i < count; i++) {
    // Spread rays in a cone from sun position
    const spread = (nextRandom(state) - 0.5) * Math.PI * 0.4;
    const baseAngle = Math.PI / 2; // Downward
    rays.push({
      originX: sunX + (nextRandom(state) - 0.5) * 200,
      originY: sunY,
      angle: baseAngle + spread,
      width: 40 + nextRandom(state) * 80,
      length: viewport.height + 200,
      opacity: 0.6 + nextRandom(state) * 0.4,
    });
  }

  return rays;
}

// Aurora Borealis - Rare atmospheric phenomenon with undulating colored waves
// Only occurs during night when temperature < 10°C, 0.02% chance per frame
// Multiple sinusoidal waves with green/blue/purple hues (120-220)
// Fades in/out gradually for dramatic effect
// Quality tiers: High: 6, Medium: 4, Low: 2
function createAuroraWaves(state: BackgroundAnimationState, viewport: ViewportSize): AuroraWave[] {
  const count = pickCount(6, state.qualityTier);
  const waves: AuroraWave[] = [];

  for (let i = 0; i < count; i++) {
    waves.push({
      baseY: viewport.height * (0.1 + nextRandom(state) * 0.3), // Upper portion of sky
      amplitude: 20 + nextRandom(state) * 40,
      wavelength: 80 + nextRandom(state) * 120,
      phase: nextRandom(state) * Math.PI * 2,
      speed: 0.01 + nextRandom(state) * 0.02,
      hue: 120 + nextRandom(state) * 100, // Green to blue/purple (120-220)
      opacity: 0.4 + nextRandom(state) * 0.4,
      thickness: 30 + nextRandom(state) * 40,
    });
  }

  return waves;
}

// Update aurora waves - Animate wave motion and handle fade in/out
function updateAuroraWaves(waves: AuroraWave[]): void {
  waves.forEach(wave => {
    wave.phase += wave.speed;
    if (wave.phase > Math.PI * 2) wave.phase -= Math.PI * 2;
  });
}

// Dust Devils - Swirling desert whirlwinds during hot, dry conditions
// Spawn when temperature > 28°C, moisture < 0.3, during daytime
// Each contains multiple particles rotating in a vortex pattern
// Rare spawn with 8s cooldown to prevent spam
function createDustDevil(state: BackgroundAnimationState, viewport: ViewportSize): DustDevil {
  const particleCount = 12 + Math.floor(nextRandom(state) * 8);
  const particles: { angle: number; distance: number; height: number; size: number }[] = [];

  const radius = 20 + nextRandom(state) * 30;
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      angle: nextRandom(state) * Math.PI * 2,
      distance: nextRandom(state) * radius,
      height: nextRandom(state) * 60,
      size: 1 + nextRandom(state) * 2,
    });
  }

  return {
    x: nextRandom(state) * viewport.width,
    y: viewport.height * 0.7 + nextRandom(state) * viewport.height * 0.2, // Lower portion
    vx: 0.5 + nextRandom(state) * 1,
    radius,
    height: 60 + nextRandom(state) * 40,
    rotation: 0,
    rotationSpeed: 0.08 + nextRandom(state) * 0.06,
    lifetime: 0,
    maxLifetime: 3000 + nextRandom(state) * 2000,
    particleCount,
    particles,
  };
}

// Update dust devils - Advance rotation, movement, and lifecycle
// Particles rotate around center creating vortex effect
function updateDustDevils(dustDevils: DustDevil[], viewport: ViewportSize): void {
  dustDevils.forEach(devil => {
    devil.x += devil.vx;
    devil.rotation += devil.rotationSpeed;
    devil.lifetime += 16;

    // Rotate particles around center
    devil.particles.forEach(p => {
      p.angle += devil.rotationSpeed;
    });

    // Remove if out of bounds or expired
    if (devil.x > viewport.width + 100 || devil.lifetime >= devil.maxLifetime) {
      devil.lifetime = devil.maxLifetime; // Mark for removal
    }
  });
}
