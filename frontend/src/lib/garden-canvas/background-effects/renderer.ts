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
}

export function renderBackgroundPass(input: BackgroundRenderInput): void {
  switch (input.pass) {
    case 'farBackground':
      drawFarBackground(input);
      break;
    case 'terrain':
      drawTerrain(input);
      break;
    case 'ambientAtmosphere':
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

  const topColor = timePhase === 'night'
    ? `rgba(5, 14, 28, ${0.95 + lighting.fogDensity * 0.1})`
    : timePhase === 'dawn'
      ? 'rgba(28, 38, 22, 0.98)'
      : timePhase === 'dusk'
        ? 'rgba(30, 27, 16, 0.98)'
        : 'rgba(8, 35, 22, 0.98)';

  const bottomColor = timePhase === 'night'
    ? 'rgba(2, 26, 14, 1)'
    : `rgba(4, ${28 + lighting.sunlight * 34}, 16, 1)`;

  baseGradient.addColorStop(0, topColor);
  baseGradient.addColorStop(1, bottomColor);
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

    ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
    ctx.fillRect(cell.x + driftX, cell.y + driftY, cell.size + 1, cell.size + 1);
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
