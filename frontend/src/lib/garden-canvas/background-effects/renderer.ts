import type {
  BackgroundPass,
  BackgroundWorldState,
  BiomeCell,
  CanopyEdge,
  CanopyNode,
  FogPatch,
  ParallaxBand,
  PointerPosition,
  RainDropParticle,
  RootPressureCell,
  MemoryRing,
  ShadowBlob,
  SporeParticle,
  ViewportSize,
  GlitchSpark,
  RippleEffect,
  FireflyParticle,
  Star,
  GodRay,
  AuroraWave,
  DustDevil,
  WindLeaf,
  PollenParticle,
  MistLayer,
  Dewdrop,
} from './types.ts';
import type { LightingContext, QualityTier, TimePhase } from '../../rendering/types.ts';

export interface BackgroundRenderInput {
  ctx: CanvasRenderingContext2D;
  viewport: ViewportSize;
  mousePos: PointerPosition;
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
  biomeDriftX: number;
  biomeDriftY: number;
  lighting: LightingContext;
  qualityTier: QualityTier;
  timePhase: TimePhase;
  worldState: BackgroundWorldState;
  pass: BackgroundPass;
  lightningOpacity?: number;
  // New visual enhancements
  fireflies: FireflyParticle[];
  stars: Star[];
  godRays: GodRay[];
  auroraWaves: AuroraWave[];
  auroraActive: boolean;
  auroraIntensity: number;
  dustDevils: DustDevil[];
  windLeaves: WindLeaf[];
  pollen: PollenParticle[];
  mistLayers: MistLayer[];
  dewdrops: Dewdrop[];
}

export function renderBackgroundPass(input: BackgroundRenderInput): void {
  switch (input.pass) {
    case 'farBackground':
      drawStars(input.ctx, input.stars, input.timePhase, input.lighting);
      drawFarBackground(input);
      drawAurora(input.ctx, input.auroraWaves, input.auroraActive, input.auroraIntensity, input.timePhase, input.viewport);
      break;
    case 'terrain':
      drawTerrain(input);
      break;
    case 'ambientAtmosphere':
      drawMistLayers(input.ctx, input.mistLayers, input.timePhase, input.worldState);
      drawGodRays(input.ctx, input.godRays, input.timePhase, input.lighting, input.worldState, input.viewport);
      drawAtmosphere(input);
      drawWeatherAtmosphereEffects(input);
      drawMemoryRings(input.ctx, input.memoryRings, 'ambient');
      break;
    case 'entityShadows':
      drawShadows(input.ctx, input.shadows, input.lighting);
      break;
    case 'foregroundParticles':
      drawSpores(input.ctx, input.spores, input.qualityTier);
      drawGlitchSparks(input.ctx, input.glitchSparks);
      drawRainDrops(input.ctx, input.rainDrops, input.lighting);
      drawWindLeaves(input.ctx, input.windLeaves);
      drawPollen(input.ctx, input.pollen, input.timePhase, input.worldState);
      drawDustDevils(input.ctx, input.dustDevils);
      drawFireflies(input.ctx, input.fireflies, input.timePhase);
      drawDewdrops(input.ctx, input.dewdrops, input.timePhase, input.worldState);
      break;
    case 'postLightVeil':
      drawPostLightVeil(input);
      drawWeatherPostVeilEffects(input);
      drawMemoryRings(input.ctx, input.memoryRings, 'veil');
      break;
    case 'entitiesBase':
    case 'entityOverlays':
      break;
  }
}

function drawFarBackground(input: BackgroundRenderInput): void {
  const { ctx, viewport, lighting, timePhase, parallaxBands, mousePos, canopyNodes, canopyEdges, worldState } = input;
  const baseGradient = ctx.createLinearGradient(0, 0, 0, viewport.height);

  let topColor, middleColor, bottomColor;

  if (timePhase === 'dawn') {
    // Dawn: Pink/orange horizon transitioning to blue-green (reduced intensity by 50%)
    const dawnProgress = Math.max(0, Math.min(1, (worldState.sunlight - 0.2) / 0.25)); // 0-1 through dawn phase
    topColor = `rgba(${15 + dawnProgress * 15}, ${20 + dawnProgress * 20}, ${40 + dawnProgress * 10}, 0.98)`;
    middleColor = `rgba(${140 + dawnProgress * 10}, ${80 + dawnProgress * 20}, ${50 - dawnProgress * 7.5}, ${0.92 + dawnProgress * 0.06})`;
    bottomColor = `rgba(${160 + dawnProgress * 10}, ${110 + dawnProgress * 15}, ${60 + dawnProgress * 7.5}, 0.95)`;
  } else if (timePhase === 'dusk') {
    // Dusk: Orange/red/purple horizon fading to dark (reduced intensity by 50%)
    const duskProgress = Math.max(0, Math.min(1, 1 - ((worldState.sunlight - 0.45) / 0.3))); // 1 at start, 0 at end
    topColor = `rgba(${30 - duskProgress * 10}, ${27 - duskProgress * 5}, ${20 - duskProgress * 2.5}, 0.98)`;
    middleColor = `rgba(${140 + duskProgress * 25}, ${70 + duskProgress * 20}, ${40 + duskProgress * 10}, ${0.90 + duskProgress * 0.05})`;
    bottomColor = `rgba(${60 + duskProgress * 50}, ${40 + duskProgress * 35}, ${20 + duskProgress * 15}, 0.95)`;
  } else if (timePhase === 'night') {
    // Night: Deep blues
    topColor = `rgba(5, 14, 28, ${0.95 + lighting.fogDensity * 0.1})`;
    bottomColor = 'rgba(2, 26, 14, 1)';
  } else {
    // Day: Green gradient
    topColor = 'rgba(8, 35, 22, 0.98)';
    bottomColor = `rgba(4, ${28 + lighting.sunlight * 34}, 16, 1)`;
  }

  // Apply gradient with 3 stops for dawn/dusk, 2 for day/night
  if (timePhase === 'dawn' || timePhase === 'dusk') {
    baseGradient.addColorStop(0, topColor);
    baseGradient.addColorStop(0.35, middleColor);
    baseGradient.addColorStop(1, bottomColor);
  } else {
    baseGradient.addColorStop(0, topColor);
    baseGradient.addColorStop(1, bottomColor);
  }

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  drawParallaxBands(ctx, viewport, parallaxBands, mousePos, 0.35);
  drawCanopyGraph(ctx, canopyNodes, canopyEdges, worldState, lighting);
}

function drawTerrain(input: BackgroundRenderInput): void {
  const {
    ctx,
    viewport,
    lighting,
    mousePos,
    biomeCells,
    rootPressureCells,
    biomeDriftX,
    biomeDriftY,
    worldState,
    parallaxBands,
  } = input;

  const parallaxX = (mousePos.x / viewport.width - 0.5) * 28;
  const parallaxY = (mousePos.y / viewport.height - 0.5) * 14;

  ctx.save();
  ctx.translate(parallaxX, parallaxY);

  const stripeCount = input.qualityTier === 'high' ? 16 : input.qualityTier === 'medium' ? 10 : 6;
  for (let index = 0; index < stripeCount; index += 1) {
    const opacity = 0.01 + (lighting.sunlight * 0.03);
    const y = (viewport.height / stripeCount) * index;
    ctx.strokeStyle = `rgba(180, 220, 120, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      viewport.width * 0.25,
      y + viewport.height * 0.1,
      viewport.width * 0.7,
      y - viewport.height * 0.08,
      viewport.width,
      y + viewport.height * 0.12,
    );
    ctx.stroke();
  }

  drawRootPressureField(ctx, rootPressureCells, worldState, lighting);
  drawBiomeField(ctx, biomeCells, biomeDriftX, biomeDriftY, worldState, lighting);
  drawParallaxBands(ctx, viewport, parallaxBands, mousePos, 0.9);

  ctx.restore();
}

function drawAtmosphere(input: BackgroundRenderInput): void {
  const { ctx, viewport, mousePos, lighting, worldState } = input;
  const ecosystemDensity = worldState.totalEntities <= 0 ? 0 : worldState.totalLiving / Math.max(1, worldState.totalEntities);
  const fungusHaze = (1 - ecosystemDensity) * 0.25 + worldState.moisture * 0.35;

  const auraGradient = ctx.createRadialGradient(
    viewport.width / 2,
    viewport.height / 2,
    0,
    viewport.width / 2,
    viewport.height / 2,
    viewport.width * 0.85,
  );
  auraGradient.addColorStop(0, `rgba(34, 197, 94, ${0.03 + lighting.bloomFactor * 0.35 + fungusHaze * 0.08})`);
  auraGradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

  ctx.fillStyle = auraGradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const glowGradient = ctx.createRadialGradient(mousePos.x, mousePos.y, 0, mousePos.x, mousePos.y, 460);
  glowGradient.addColorStop(0, `rgba(210, 230, 150, ${0.02 + lighting.ambientLevel * 0.05 + worldState.sunlight * 0.04})`);
  glowGradient.addColorStop(1, 'rgba(210, 230, 150, 0)');

  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

function drawShadows(
  ctx: CanvasRenderingContext2D,
  shadows: ShadowBlob[],
  lighting: LightingContext,
): void {
  shadows.forEach((shadow) => {
    const shadowGradient = ctx.createRadialGradient(shadow.x, shadow.y, 0, shadow.x, shadow.y, shadow.size);
    shadowGradient.addColorStop(0, `rgba(0, 15, 5, ${shadow.opacity * lighting.shadowStrength})`);
    shadowGradient.addColorStop(1, 'rgba(0, 15, 5, 0)');

    ctx.fillStyle = shadowGradient;
    ctx.fillRect(shadow.x - shadow.size, shadow.y - shadow.size, shadow.size * 2, shadow.size * 2);
  });
}

function drawSpores(ctx: CanvasRenderingContext2D, spores: SporeParticle[], qualityTier: QualityTier): void {
  const maxDepthGlow = qualityTier === 'low' ? 0.2 : 0.45;
  spores.forEach((spore) => {
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, spore.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 240, 160, ${spore.opacity})`;
    ctx.fill();

    const glowGradient = ctx.createRadialGradient(spore.x, spore.y, 0, spore.x, spore.y, spore.size * (3 + spore.depth * 3));
    glowGradient.addColorStop(0, `rgba(220, 240, 160, ${spore.opacity * maxDepthGlow})`);
    glowGradient.addColorStop(1, 'rgba(220, 240, 160, 0)');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, spore.size * (3 + spore.depth * 3), 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGlitchSparks(ctx: CanvasRenderingContext2D, glitchSparks: GlitchSpark[]): void {
  glitchSparks.forEach((spark) => {
    if (spark.opacity <= 0) return;

    ctx.save();
    const baseColor = `rgba(${spark.color}, ${spark.opacity * 0.7})`;
    const glowColor = `rgba(${spark.color}, ${spark.opacity * 0.3})`;

    const glowGradient = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.size * 2.5);
    glowGradient.addColorStop(0, glowColor);
    glowGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    const halfSize = spark.size * 0.5;

    if (spark.shape === 1) {
      ctx.rect(spark.x - halfSize, spark.y - halfSize, spark.size, spark.size);
    } else {
      ctx.arc(spark.x, spark.y, halfSize, 0, Math.PI * 2);
    }

    ctx.fill();
    ctx.restore();
  });
}

function drawPostLightVeil(input: BackgroundRenderInput): void {
  const { ctx, viewport, lighting, timePhase, worldState } = input;
  const veilGradient = ctx.createLinearGradient(0, 0, 0, viewport.height);

  const upperAlpha = timePhase === 'night' ? 0.24 : 0.07 + (1 - lighting.sunlight) * 0.12;
  const lowerAlpha = 0.02 + lighting.fogDensity * 0.1 + worldState.moisture * 0.08;

  veilGradient.addColorStop(0, `rgba(15, 25, 40, ${upperAlpha})`);
  veilGradient.addColorStop(1, `rgba(12, 26, 16, ${lowerAlpha})`);

  ctx.fillStyle = veilGradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

function drawOrganicBiomeShape(
  ctx: CanvasRenderingContext2D,
  radiusX: number,
  radiusY: number,
  shapeType: number,
  curveVariation: number,
): void {
  ctx.beginPath();

  switch (shapeType) {
    case 0: {
      // Simple ellipse
      ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
      break;
    }
    case 1: {
      // Organic blob with 4 bezier curves
      const curve = curveVariation * 0.3 + 0.5;
      ctx.moveTo(radiusX, 0);
      ctx.bezierCurveTo(
        radiusX, radiusY * curve,
        radiusX * curve, radiusY,
        0, radiusY,
      );
      ctx.bezierCurveTo(
        -radiusX * curve, radiusY,
        -radiusX, radiusY * curve,
        -radiusX, 0,
      );
      ctx.bezierCurveTo(
        -radiusX, -radiusY * curve,
        -radiusX * curve, -radiusY,
        0, -radiusY,
      );
      ctx.bezierCurveTo(
        radiusX * curve, -radiusY,
        radiusX, -radiusY * curve,
        radiusX, 0,
      );
      break;
    }
    case 2: {
      // Rounded irregular blob
      const points = 6;
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const nextAngle = ((i + 1) / points) * Math.PI * 2;
        const variation = 0.7 + (Math.sin(i + curveVariation * 10) * 0.3);
        const nextVariation = 0.7 + (Math.sin(i + 1 + curveVariation * 10) * 0.3);

        const x = Math.cos(angle) * radiusX * variation;
        const y = Math.sin(angle) * radiusY * variation;
        const nextX = Math.cos(nextAngle) * radiusX * nextVariation;
        const nextY = Math.sin(nextAngle) * radiusY * nextVariation;

        if (i === 0) {
          ctx.moveTo(x, y);
        }

        const cpAngle = (angle + nextAngle) / 2;
        const cpDist = 1.2 + curveVariation * 0.3;
        const cpX = Math.cos(cpAngle) * radiusX * cpDist;
        const cpY = Math.sin(cpAngle) * radiusY * cpDist;

        ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
      }
      break;
    }
    case 3: {
      // Petal-like shape
      const petals = 5;
      for (let i = 0; i < petals; i++) {
        const angle = (i / petals) * Math.PI * 2;
        const nextAngle = ((i + 1) / petals) * Math.PI * 2;
        const midAngle = (angle + nextAngle) / 2;

        const r1 = radiusX * (0.5 + curveVariation * 0.3);
        const r2 = radiusX * (0.9 + curveVariation * 0.2);

        const x1 = Math.cos(angle) * r1;
        const y1 = Math.sin(angle) * r1;
        const x2 = Math.cos(midAngle) * r2;
        const y2 = Math.sin(midAngle) * r2;
        const x3 = Math.cos(nextAngle) * r1;
        const y3 = Math.sin(nextAngle) * r1;

        if (i === 0) {
          ctx.moveTo(x1, y1);
        }

        ctx.quadraticCurveTo(x2, y2, x3, y3);
      }
      break;
    }
    case 4: {
      // Squiggly irregular blob
      const segments = 8;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const nextAngle = ((i + 1) / segments) * Math.PI * 2;

        const wobble1 = Math.sin(i * 2.3 + curveVariation * 20) * 0.25;
        const wobble2 = Math.sin((i + 1) * 2.3 + curveVariation * 20) * 0.25;

        const r1 = radiusX * (0.8 + wobble1);
        const r2 = radiusX * (0.8 + wobble2);

        const x = Math.cos(angle) * r1;
        const y = Math.sin(angle) * radiusY * (0.8 + wobble1);
        const nextX = Math.cos(nextAngle) * r2;
        const nextY = Math.sin(nextAngle) * radiusY * (0.8 + wobble2);

        if (i === 0) {
          ctx.moveTo(x, y);
        }

        // Smooth curve to next point
        const midAngle = (angle + nextAngle) / 2;
        const cpX = Math.cos(midAngle) * radiusX * 0.9;
        const cpY = Math.sin(midAngle) * radiusY * 0.9;
        ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
      }
      break;
    }
  }
}

function drawBiomeField(
  ctx: CanvasRenderingContext2D,
  biomeCells: BiomeCell[],
  biomeDriftX: number,
  biomeDriftY: number,
  worldState: BackgroundWorldState,
  lighting: LightingContext,
): void {
  const driftX = biomeDriftX % 80;
  const driftY = biomeDriftY % 80;

  biomeCells.forEach((cell) => {
    const temperatureNorm = Math.max(0, Math.min(1, worldState.temperature / 40));
    const fertility = Math.max(0, Math.min(1, (cell.fertility * 0.7 + worldState.moisture * 0.3)));
    const corruption = Math.max(0, Math.min(1, cell.corruption * (1.2 - worldState.sunlight * 0.6)));
    const hue = 88 + fertility * 46 - corruption * 32 + temperatureNorm * 8;
    const saturation = 30 + fertility * 22;
    const lightness = 12 + fertility * 10 + lighting.sunlight * 6 - corruption * 6;
    const alpha = 0.025 + fertility * 0.045 + corruption * 0.03;

    // Calculate center position with drift and offset
    const centerX = cell.x + cell.size * 0.5 + driftX + cell.offsetX;
    const centerY = cell.y + cell.size * 0.5 + driftY + cell.offsetY;

    // Save context for rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(cell.tilt);

    // Create radial gradient for soft edges
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, cell.radiusX);
    gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`);
    gradient.addColorStop(0.7, `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha * 0.6})`);
    gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);

    ctx.fillStyle = gradient;

    // Draw organic shape based on shapeType
    drawOrganicBiomeShape(ctx, cell.radiusX, cell.radiusY, cell.shapeType, cell.curveVariation);
    ctx.fill();

    ctx.restore();
  });
}

function drawRootPressureField(
  ctx: CanvasRenderingContext2D,
  rootPressureCells: RootPressureCell[],
  worldState: BackgroundWorldState,
  lighting: LightingContext,
): void {
  const plantDensity = Math.max(0, Math.min(1, worldState.plantDensity ?? 0));
  const fungusDensity = Math.max(0, Math.min(1, worldState.fungusDensity ?? 0));
  const moisture = Math.max(0, Math.min(1, worldState.moisture));

  // Biological load pushes the soil pressure effect upward.
  const ecosystemLoad = (plantDensity * 0.65) + (fungusDensity * 0.35);
  const loadAlpha = 0.022 + ecosystemLoad * 0.038 + moisture * 0.014;

  rootPressureCells.forEach((cell) => {
    const radiusX = cell.size * (0.28 + cell.pressure * 0.32);
    const radiusY = cell.size * (0.11 + cell.pressure * 0.15);
    const centerX = cell.x + cell.size * 0.5;
    const centerY = cell.y + cell.size * (0.34 + cell.pressure * 0.14);
    const hue = 116 + cell.pressure * 6 - fungusDensity * 4;
    const alpha = loadAlpha * (0.55 + cell.pressure * 0.45) * (0.75 + lighting.ambientLevel * 0.25);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(cell.tilt);

    const pressureGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    pressureGradient.addColorStop(0, `hsla(${hue}, 24%, 8%, ${alpha})`);
    pressureGradient.addColorStop(1, `hsla(${hue}, 20%, 4%, 0)`);

    ctx.fillStyle = pressureGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `hsla(${hue + 3}, 20%, 10%, ${alpha * 0.32})`;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(-radiusX * 0.7, 0);
    ctx.quadraticCurveTo(0, -radiusY * 0.25, radiusX * 0.7, 0);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${hue - 6}, 16%, 7%, ${alpha * 0.2})`;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(-radiusX * 0.5, radiusY * 0.12);
    ctx.quadraticCurveTo(0, radiusY * 0.32, radiusX * 0.5, radiusY * 0.12);
    ctx.stroke();

    ctx.restore();
  });
}

function drawParallaxBands(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  parallaxBands: ParallaxBand[],
  mousePos: PointerPosition,
  depthMultiplier: number,
): void {
  const mouseShift = (mousePos.x / viewport.width - 0.5) * 14;

  parallaxBands.forEach((band) => {
    const depthShift = mouseShift * (1 - band.depth) * depthMultiplier;
    const steps = 14;
    ctx.strokeStyle = `hsla(${band.hue}, 40%, 57%, ${band.opacity * (0.58 + (1 - band.depth) * 0.24)})`;
    ctx.lineWidth = Math.max(0.35, band.thickness);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let index = 0; index <= steps; index += 1) {
      const x = (viewport.width / steps) * index;
      const y = band.baseY + Math.sin((x / band.wavelength) + band.phase) * band.amplitude;
      if (index === 0) {
        ctx.moveTo(x + depthShift, y);
      } else {
        ctx.lineTo(x + depthShift, y);
      }
    }
    ctx.stroke();
  });
}

function drawMemoryRings(
  ctx: CanvasRenderingContext2D,
  memoryRings: MemoryRing[],
  layer: 'ambient' | 'veil',
): void {
  memoryRings.forEach((ring) => {
    const lifeProgress = ring.age / Math.max(1, ring.maxAge);
    const alphaBase = layer === 'ambient' ? 1 : 0.55;
    const alpha = ring.opacity * (1 - lifeProgress * 0.7) * alphaBase;
    if (alpha <= 0.003) return;

    const color = ring.ringType === 'growth'
      ? { hue: 132, sat: 54, light: 66 }
      : ring.ringType === 'decay'
        ? { hue: 14, sat: 58, light: 60 }
        : ring.ringType === 'stress'
          ? { hue: 40, sat: 62, light: 64 }
          : { hue: 196, sat: 42, light: 68 };

    const ringsToDraw = layer === 'ambient' ? 2 : 1;
    const spacing = 16 + lifeProgress * 22;

    for (let index = 0; index < ringsToDraw; index += 1) {
      const radius = ring.radius + index * spacing;
      ctx.save();
      ctx.strokeStyle = `hsla(${color.hue}, ${color.sat}%, ${color.light}%, ${alpha * (1 - index * 0.3)})`;
      ctx.lineWidth = layer === 'ambient' ? 1.2 : 0.9;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (ring.ringType === 'decay' && layer === 'ambient') {
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = `hsla(${color.hue + 8}, ${color.sat - 8}%, ${color.light - 10}%, ${alpha * 0.45})`;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  });
}

// ==========================================
// Weather-Specific Rendering
// ==========================================

function drawWeatherAtmosphereEffects(input: BackgroundRenderInput): void {
  const { ctx, viewport, lighting, worldState, fogPatches, lightningOpacity } = input;
  const weather = worldState.weatherStateName;

  // Cloud shadow overlay for overcast/rain/storm
  if (weather === 'OVERCAST' || weather === 'RAIN' || weather === 'STORM') {
    const cloudDensity = weather === 'STORM' ? 0.28 : weather === 'RAIN' ? 0.18 : 0.12;
    const cloudGradient = ctx.createLinearGradient(0, 0, 0, viewport.height * 0.7);
    cloudGradient.addColorStop(0, `rgba(5, 8, 14, ${cloudDensity + lighting.fogDensity * 0.1})`);
    cloudGradient.addColorStop(0.4, `rgba(8, 12, 18, ${cloudDensity * 0.6})`);
    cloudGradient.addColorStop(1, 'rgba(8, 12, 18, 0)');
    ctx.fillStyle = cloudGradient;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  // Fog patches
  if (fogPatches.length > 0) {
    fogPatches.forEach((patch) => {
      const fogGradient = ctx.createRadialGradient(
        patch.x, patch.y, 0,
        patch.x, patch.y, patch.radius,
      );
      const alphaScale = weather === 'FOG' ? 1.5 : 1.0;
      fogGradient.addColorStop(0, `rgba(200, 210, 200, ${patch.opacity * alphaScale})`);
      fogGradient.addColorStop(0.6, `rgba(180, 190, 180, ${patch.opacity * 0.6 * alphaScale})`);
      fogGradient.addColorStop(1, 'rgba(180, 190, 180, 0)');
      ctx.fillStyle = fogGradient;
      ctx.fillRect(
        patch.x - patch.radius, patch.y - patch.radius,
        patch.radius * 2, patch.radius * 2,
      );
    });
  }

  // Lightning Flash
  if (lightningOpacity && lightningOpacity > 0) {
    ctx.fillStyle = `rgba(230, 240, 255, ${lightningOpacity})`;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }
}

function drawRainDrops(
  ctx: CanvasRenderingContext2D,
  rainDrops: RainDropParticle[],
  lighting: LightingContext,
): void {
  if (rainDrops.length === 0) return;

  const baseAlpha = 0.25 + lighting.ambientLevel * 0.1;
  ctx.strokeStyle = `rgba(180, 210, 235, ${baseAlpha})`;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';

  rainDrops.forEach((drop) => {
    ctx.globalAlpha = drop.opacity;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + drop.windOffset * 2, drop.y + drop.length);
    ctx.stroke();

    // Occasional splash at bottom
    if (drop.y > 550 && Math.random() > 0.98) {
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, 2, 0, Math.PI, true);
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1;
}

function drawWeatherPostVeilEffects(input: BackgroundRenderInput): void {
  const { ctx, viewport, worldState } = input;
  const weather = worldState.weatherStateName;

  // Drought warm tint + heat haze
  if (weather === 'DROUGHT') {
    const heatGradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
    heatGradient.addColorStop(0, 'rgba(210, 140, 30, 0.12)');
    heatGradient.addColorStop(0.5, 'rgba(230, 160, 40, 0.08)');
    heatGradient.addColorStop(1, 'rgba(190, 110, 20, 0.04)');
    ctx.fillStyle = heatGradient;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Subtle heat haze shimmer
    const shimmer = Math.sin((worldState.tick || 0) * 0.1) * 2;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.translate(0, shimmer);
    ctx.fillStyle = 'rgba(255, 230, 180, 0.1)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(0, (viewport.height / 5) * i, viewport.width, 2);
    }
    ctx.restore();
  }

  // Storm extra darkness
  if (weather === 'STORM') {
    ctx.fillStyle = 'rgba(2, 4, 10, 0.15)';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  // Heavy Fog veil
  if (weather === 'FOG') {
    ctx.fillStyle = 'rgba(180, 190, 180, 0.15)';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }
}

function drawCanopyGraph(
  ctx: CanvasRenderingContext2D,
  canopyNodes: CanopyNode[],
  canopyEdges: CanopyEdge[],
  worldState: BackgroundWorldState,
  lighting: LightingContext,
): void {
  if (canopyNodes.length === 0 || canopyEdges.length === 0) return;

  const plantDensity = Math.max(0, Math.min(1, worldState.plantDensity ?? 0.25));
  const livingFactor = Math.max(0, Math.min(1, worldState.totalLiving / 400));
  const densityFactor = Math.max(0.28, Math.min(1, 0.26 + plantDensity * 0.72 + livingFactor * 0.4));
  const visibleEdges = Math.max(1, Math.floor(canopyEdges.length * densityFactor));
  const baseAlpha = 0.045 + densityFactor * 0.08 + (1 - lighting.sunlight) * 0.03;

  const nodeById = new Map<number, CanopyNode>();
  canopyNodes.forEach((node) => nodeById.set(node.id, node));

  for (let index = 0; index < visibleEdges; index += 1) {
    const edge = canopyEdges[index]!;
    const from = nodeById.get(edge.fromId);
    const to = nodeById.get(edge.toId);
    if (!from || !to) continue;

    const controlX = (from.x + to.x) * 0.5 + edge.curve * (0.6 + from.depth * 0.4);
    const controlY = (from.y + to.y) * 0.5 - Math.abs(edge.curve) * 0.2;

    const weather = worldState.weatherStateName;
    const baseHue = weather === 'DROUGHT' ? 60 : weather === 'STORM' ? 100 : 88;
    const saturation = weather === 'DROUGHT' ? 25 : weather === 'RAIN' || weather === 'STORM' ? 50 : 42;
    const lightness = weather === 'DROUGHT' ? 45 : weather === 'STORM' ? 40 : 62;

    ctx.strokeStyle = `hsla(${baseHue + from.depth * 44}, ${saturation}%, ${lightness}%, ${baseAlpha * edge.weight})`;
    ctx.lineWidth = edge.thickness * (0.9 + from.depth * 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(controlX, controlY, to.x, to.y);
    ctx.stroke();
  }
}

// ============================================================================
// New Visual Enhancement Rendering Functions
// ============================================================================

// Draw stars - Twinkling night sky effect
// Only visible during night phase, opacity modulated by sine wave for twinkling
// Larger stars (>1.0) get an additional radial glow for prominence
// Fog reduces visibility
function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  timePhase: TimePhase,
  lighting: LightingContext,
): void {
  if (timePhase !== 'night' || stars.length === 0) return;

  stars.forEach(star => {
    const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7; // 0.4-1.0
    const opacity = star.brightness * twinkle * (1 - lighting.fogDensity * 0.7);

    ctx.fillStyle = `rgba(255, 255, 240, ${opacity})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();

    // Glow for larger stars
    if (star.size > 1.0) {
      const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 4);
      gradient.addColorStop(0, `rgba(255, 255, 240, ${opacity * 0.3})`);
      gradient.addColorStop(1, 'rgba(255, 255, 240, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Draw fireflies - Glowing insects with pulsing radial halos
// Active at dusk and night, each has unique glow phase for natural variation
// Two-layer rendering: outer glow halo (gradient) + bright core (solid)
// Yellow-green bioluminescent color palette
function drawFireflies(
  ctx: CanvasRenderingContext2D,
  fireflies: FireflyParticle[],
  timePhase: TimePhase,
): void {
  if ((timePhase !== 'dusk' && timePhase !== 'night') || fireflies.length === 0) return;

  fireflies.forEach(firefly => {
    const glow = Math.sin(firefly.glowPhase) * 0.5 + 0.5; // 0-1
    const opacity = firefly.baseOpacity * glow;

    // Glow halo
    const gradient = ctx.createRadialGradient(firefly.x, firefly.y, 0, firefly.x, firefly.y, firefly.size * 8);
    gradient.addColorStop(0, `rgba(220, 255, 180, ${opacity * 0.6})`);
    gradient.addColorStop(0.4, `rgba(200, 240, 140, ${opacity * 0.3})`);
    gradient.addColorStop(1, 'rgba(200, 240, 140, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(firefly.x - firefly.size * 8, firefly.y - firefly.size * 8, firefly.size * 16, firefly.size * 16);

    // Core
    ctx.fillStyle = `rgba(255, 255, 200, ${opacity})`;
    ctx.beginPath();
    ctx.arc(firefly.x, firefly.y, firefly.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Draw wind leaves - Tumbling foliage particles drifting with the wind
// Color varies by temperature (cold = autumn colors, warm = spring colors)
// Depth creates parallax effect (closer leaves more opaque)
// Simple ellipse shape with rotation for natural leaf appearance
function drawWindLeaves(ctx: CanvasRenderingContext2D, leaves: WindLeaf[]): void {
  if (leaves.length === 0) return;

  leaves.forEach(leaf => {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.rotation);
    ctx.globalAlpha = leaf.opacity * (0.6 + leaf.depth * 0.4);

    const colorMap = {
      green: 'rgba(120, 180, 80, 1)',
      yellow: 'rgba(220, 200, 80, 1)',
      orange: 'rgba(230, 140, 60, 1)',
      pink: 'rgba(240, 160, 180, 1)',
    };

    ctx.fillStyle = colorMap[leaf.color];
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.size * 1.5, leaf.size, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

// Draw pollen - Yellow glowing particles floating from plants
// Only active during day when plant density > 0.2
// Two-layer rendering: soft outer glow + brighter core
// Golden/yellow color suggests plant pollen
function drawPollen(
  ctx: CanvasRenderingContext2D,
  pollen: PollenParticle[],
  timePhase: TimePhase,
  worldState: BackgroundWorldState,
): void {
  if (timePhase !== 'day' || (worldState.plantDensity ?? 0) < 0.2 || pollen.length === 0) return;

  pollen.forEach(particle => {
    // Soft glow
    const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 3);
    gradient.addColorStop(0, `rgba(255, 250, 180, ${particle.opacity * 0.3})`);
    gradient.addColorStop(1, 'rgba(255, 250, 180, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = `rgba(255, 245, 200, ${particle.opacity})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Draw mist layers - Ground-hugging fog with radial gradient falloff
// Active at dawn (burning off) and night when moisture > 0.5
// Visibility fades during dawn as sunlight increases
// Blue-grey color suggests morning mist
function drawMistLayers(
  ctx: CanvasRenderingContext2D,
  mist: MistLayer[],
  timePhase: TimePhase,
  worldState: BackgroundWorldState,
): void {
  if ((timePhase !== 'dawn' && timePhase !== 'night') || (worldState.moisture ?? 0) < 0.5 || mist.length === 0) return;

  const mistVisibility = timePhase === 'night' ? 1.0 : 1.0 - ((worldState.sunlight - 0.2) / 0.25);

  mist.forEach(layer => {
    const gradient = ctx.createRadialGradient(
      layer.x + layer.width / 2, layer.y, layer.width * 0.1,
      layer.x + layer.width / 2, layer.y, layer.width * 0.7,
    );
    gradient.addColorStop(0, `rgba(200, 210, 215, ${layer.opacity * mistVisibility * 0.2})`);
    gradient.addColorStop(0.6, `rgba(190, 200, 205, ${layer.opacity * mistVisibility * 0.12})`);
    gradient.addColorStop(1, 'rgba(190, 200, 205, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(layer.x, layer.y - layer.height / 2, layer.width, layer.height);
  });
}

// Draw dewdrops - Sparkling water droplets catching morning light
// Only active during dawn when moisture > 0.6, fade as sun rises
// Radial gradient with white center to blue edge creates rainbow prism effect
// Sine wave sparkle phase makes them shimmer naturally
function drawDewdrops(
  ctx: CanvasRenderingContext2D,
  dewdrops: Dewdrop[],
  timePhase: TimePhase,
  worldState: BackgroundWorldState,
): void {
  if (timePhase !== 'dawn' || (worldState.moisture ?? 0) < 0.6 || dewdrops.length === 0) return;

  const dawnProgress = (worldState.sunlight - 0.2) / 0.25;
  const visibility = 1 - dawnProgress * 0.8; // Fade as sun rises

  dewdrops.forEach(drop => {
    const sparkle = Math.sin(drop.sparklePhase) * 0.5 + 0.5;

    // Rainbow sparkle
    const gradient = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.size * 3);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${sparkle * 0.8 * visibility})`);
    gradient.addColorStop(0.3, `rgba(200, 220, 255, ${sparkle * 0.4 * visibility})`);
    gradient.addColorStop(1, 'rgba(200, 220, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.size * 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Draw god rays - Volumetric light shafts emanating from the sun
// Active during day/dawn/dusk when sun is visible above horizon
// Intensity modulated by weather (reduced in fog/rain, enhanced in drought)
// Linear gradient creates beam of light effect
function drawGodRays(
  ctx: CanvasRenderingContext2D,
  godRays: GodRay[],
  timePhase: TimePhase,
  lighting: LightingContext,
  worldState: BackgroundWorldState,
  viewport: ViewportSize,
): void {
  if ((timePhase !== 'day' && timePhase !== 'dawn' && timePhase !== 'dusk') || godRays.length === 0) return;

  const weather = worldState.weatherStateName;
  const rayIntensity = timePhase === 'day' ? 1.0 : 0.6;

  // Weather modifications
  let weatherMod = 1.0;
  if (weather === 'DROUGHT') weatherMod = 1.4;
  else if (weather === 'RAIN' || weather === 'STORM') weatherMod = 0.3;
  else if (weather === 'FOG' || weather === 'OVERCAST') weatherMod = 0.5;

  const baseOpacity = (1 - lighting.fogDensity * 0.5) * rayIntensity * lighting.bloomFactor * weatherMod;

  godRays.forEach(ray => {
    ctx.save();
    ctx.translate(ray.originX, ray.originY);
    ctx.rotate(ray.angle);

    const gradient = ctx.createLinearGradient(0, 0, 0, ray.length);
    gradient.addColorStop(0, `rgba(255, 250, 220, ${ray.opacity * baseOpacity * 0.15})`);
    gradient.addColorStop(0.3, `rgba(255, 250, 220, ${ray.opacity * baseOpacity * 0.08})`);
    gradient.addColorStop(1, 'rgba(255, 250, 220, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(-ray.width / 2, 0, ray.width, ray.length);
    ctx.restore();
  });
}

// Draw aurora - Rare atmospheric light show with undulating colored waves
// Only visible at night during cold temperatures (< 10°C)
// Uses additive blending for ethereal glow effect
// Multiple sinusoidal waves with green/blue/purple hues
function drawAurora(
  ctx: CanvasRenderingContext2D,
  auroraWaves: AuroraWave[],
  auroraActive: boolean,
  auroraIntensity: number,
  timePhase: TimePhase,
  viewport: ViewportSize,
): void {
  if (!auroraActive || auroraWaves.length === 0 || timePhase !== 'night') return;

  const intensity = Math.abs(auroraIntensity); // Handle negative (fade out) intensity

  auroraWaves.forEach(wave => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Additive blending for ethereal glow

    // Create vertical gradient for wave
    const gradient = ctx.createLinearGradient(0, wave.baseY - wave.amplitude, 0, wave.baseY + wave.amplitude);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, `hsla(${wave.hue}, 70%, 60%, ${wave.opacity * intensity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = wave.thickness;
    ctx.lineCap = 'round';

    // Draw sinusoidal wave path
    const steps = 50;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = (viewport.width / steps) * i;
      const y = wave.baseY + Math.sin((x / wave.wavelength) + wave.phase) * wave.amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  });
}

// Draw dust devils - Swirling desert whirlwinds with rotating particles
// Active during hot, dry daytime (temp > 28°C, moisture < 0.3)
// Particles rotate in vortex pattern, fade in/out based on lifetime
// Brown/tan dust color suggests desert conditions
function drawDustDevils(ctx: CanvasRenderingContext2D, dustDevils: DustDevil[]): void {
  if (dustDevils.length === 0) return;

  dustDevils.forEach(devil => {
    const lifeFactor = 1 - (devil.lifetime / devil.maxLifetime);
    const alpha = Math.sin(lifeFactor * Math.PI); // Fade in/out

    devil.particles.forEach(particle => {
      const px = devil.x + Math.cos(particle.angle) * particle.distance;
      const py = devil.y - particle.height + Math.sin(particle.angle * 2) * 5;

      ctx.fillStyle = `rgba(180, 160, 120, ${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}
