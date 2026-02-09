import type { GlitchSpark, PointerPosition, ShadowBlob, SporeParticle, ViewportSize } from './types.ts';

export interface BackgroundRenderInput {
  ctx: CanvasRenderingContext2D;
  viewport: ViewportSize;
  mousePos: PointerPosition;
  spores: SporeParticle[];
  shadows: ShadowBlob[];
  glitchSparks: GlitchSpark[];
}

export function renderBackgroundEffects(input: BackgroundRenderInput): void {
  drawAura(input.ctx, input.viewport);
  drawAtmosphere(input.ctx, input.viewport, input.mousePos);
  drawShadows(input.ctx, input.shadows);
  drawSpores(input.ctx, input.spores);
  drawGlitchSparks(input.ctx, input.glitchSparks);
}

function drawAura(ctx: CanvasRenderingContext2D, viewport: ViewportSize): void {
  const time = Date.now() / 6000;
  const pulse = (Math.sin(time) + 1) / 2;

  ctx.save();
  const auraGradient = ctx.createRadialGradient(
    viewport.width / 2,
    viewport.height / 2,
    0,
    viewport.width / 2,
    viewport.height / 2,
    viewport.width * 0.8,
  );
  auraGradient.addColorStop(0, `rgba(34, 197, 94, ${0.08 + pulse * 0.15})`);
  auraGradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

  ctx.fillStyle = auraGradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.restore();
}

function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportSize,
  mousePos: PointerPosition,
): void {
  const parallaxX = (mousePos.x / viewport.width - 0.5) * 20;
  const parallaxY = (mousePos.y / viewport.height - 0.5) * 20;

  ctx.save();
  ctx.translate(parallaxX, parallaxY);
  ctx.strokeStyle = 'rgba(210, 230, 150, 0.02)';
  ctx.lineWidth = 1;

  for (let index = 0; index < 5; index += 1) {
    ctx.beginPath();
    ctx.moveTo(0, viewport.height * 0.2 * index);
    ctx.bezierCurveTo(
      viewport.width * 0.3,
      viewport.height * 0.5,
      viewport.width * 0.7,
      viewport.height * 0.1,
      viewport.width,
      viewport.height * 0.8 * index,
    );
    ctx.stroke();
  }

  ctx.restore();

  const glowGradient = ctx.createRadialGradient(mousePos.x, mousePos.y, 0, mousePos.x, mousePos.y, 500);
  glowGradient.addColorStop(0, 'rgba(210, 230, 150, 0.07)');
  glowGradient.addColorStop(1, 'rgba(210, 230, 150, 0)');

  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

function drawShadows(ctx: CanvasRenderingContext2D, shadows: ShadowBlob[]): void {
  shadows.forEach((shadow) => {
    ctx.save();

    const shadowGradient = ctx.createRadialGradient(shadow.x, shadow.y, 0, shadow.x, shadow.y, shadow.size);
    shadowGradient.addColorStop(0, `rgba(0, 15, 5, ${shadow.opacity})`);
    shadowGradient.addColorStop(1, 'rgba(0, 15, 5, 0)');

    ctx.fillStyle = shadowGradient;
    ctx.fillRect(shadow.x - shadow.size, shadow.y - shadow.size, shadow.size * 2, shadow.size * 2);
    ctx.restore();
  });
}

function drawSpores(ctx: CanvasRenderingContext2D, spores: SporeParticle[]): void {
  spores.forEach((spore) => {
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, spore.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 240, 160, ${spore.opacity})`;
    ctx.fill();

    const glowGradient = ctx.createRadialGradient(spore.x, spore.y, 0, spore.x, spore.y, spore.size * 5);
    glowGradient.addColorStop(0, `rgba(220, 240, 160, ${spore.opacity * 0.4})`);
    glowGradient.addColorStop(1, 'rgba(220, 240, 160, 0)');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, spore.size * 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGlitchSparks(ctx: CanvasRenderingContext2D, glitchSparks: GlitchSpark[]): void {
  glitchSparks.forEach((spark) => {
    if (spark.opacity <= 0) return;

    ctx.save();
    const baseColor = `rgba(${spark.color}, ${spark.opacity * 0.7})`;
    const glowColor = `rgba(${spark.color}, ${spark.opacity * 0.3})`;

    const glowGradient = ctx.createRadialGradient(
      spark.x,
      spark.y,
      0,
      spark.x,
      spark.y,
      spark.size * 2.5,
    );
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
