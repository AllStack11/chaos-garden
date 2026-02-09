import type { Entity } from '../../../env.d.ts';
import type { CarnivoreVisual } from '../CarnivoreVisualSystem.ts';

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export class CarnivoreRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private random: SeededRandom | null = null;

  render(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'carnivore' }>,
    visual: CarnivoreVisual,
    x: number,
    y: number,
    time: number,
  ): void {
    this.ctx = ctx;
    this.random = new SeededRandom(visual.visualSeed);

    const size = this.calculateSize(entity.energy, visual);
    const bob = Math.sin(time * 3 + visual.visualSeed * 0.0006) * size * 0.02;
    const bodyX = x;
    const bodyY = y - bob;
    const isHunting = entity.energy < 50;
    const healthFactor = entity.health / 100;

    switch (visual.predatorType) {
      case 'wolf':
        this.renderWolf(bodyX, bodyY, size, visual, time);
        break;
      case 'fox':
        this.renderFox(bodyX, bodyY, size, visual, time);
        break;
      case 'bigCat':
        this.renderBigCat(bodyX, bodyY, size, visual, time);
        break;
    }

    this.renderEyes(bodyX, bodyY, size, isHunting);
    this.renderAura(bodyX, bodyY, size, visual, isHunting, healthFactor, time);
  }

  private calculateSize(energy: number, visual: CarnivoreVisual): number {
    return (8 + energy / 14) * visual.bodyScale;
  }

  private renderWolf(
    x: number,
    y: number,
    size: number,
    visual: CarnivoreVisual,
    time: number,
  ): void {
    this.renderMammalBody(x, y, size, visual, time, 0.9);
  }

  private renderFox(
    x: number,
    y: number,
    size: number,
    visual: CarnivoreVisual,
    time: number,
  ): void {
    this.renderMammalBody(x, y, size, visual, time, 1.2);
  }

  private renderBigCat(
    x: number,
    y: number,
    size: number,
    visual: CarnivoreVisual,
    time: number,
  ): void {
    this.renderMammalBody(x, y, size, visual, time, 0.75);
  }

  private renderMammalBody(
    x: number,
    y: number,
    size: number,
    visual: CarnivoreVisual,
    time: number,
    tailFluff: number,
  ): void {
    if (!this.ctx) return;

    const bodyWidth = size * 0.52;
    const bodyLength = size * visual.bodyLengthRatio;
    const headRadius = size * 0.24 * visual.headSize;
    const tailSwing = Math.sin(time * (2.2 + visual.genome.carnivore.tailDynamics * 0.4) + x * 0.01) * size * 0.06;
    const stance = size * 0.6 * visual.stanceWidth * visual.genome.carnivore.stanceProfile;

    this.renderLegs(x, y, size, visual, stance, time);

    this.ctx.fillStyle = visual.baseColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, bodyLength * 0.5, bodyWidth, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.renderPattern(x, y, bodyLength, bodyWidth, visual);

    this.ctx.fillStyle = visual.accentColor;
    this.ctx.beginPath();
    this.ctx.arc(x + bodyLength * 0.46, y - bodyWidth * 0.2, headRadius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = visual.baseColor;
    this.ctx.lineWidth = Math.max(1.5, size * 0.08);
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x - bodyLength * 0.48, y - bodyWidth * 0.15);
    this.ctx.quadraticCurveTo(
      x - bodyLength * 0.8,
      y - bodyWidth * 0.5 + tailSwing,
      x - bodyLength * (0.95 + tailFluff * 0.12),
      y - bodyWidth * 0.2 + tailSwing,
    );
    this.ctx.stroke();

    if (visual.fangSize > 0.1) {
      this.ctx.fillStyle = '#f5f3eb';
      this.ctx.beginPath();
      this.ctx.moveTo(x + bodyLength * 0.6, y + bodyWidth * 0.04);
      this.ctx.lineTo(x + bodyLength * 0.66, y + bodyWidth * 0.12 + visual.fangSize * 2);
      this.ctx.lineTo(x + bodyLength * 0.55, y + bodyWidth * 0.1);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  private renderPattern(
    x: number,
    y: number,
    bodyLength: number,
    bodyWidth: number,
    visual: CarnivoreVisual,
  ): void {
    if (!this.ctx || visual.patternType === 'solid') return;

    this.ctx.strokeStyle = visual.patternColor;
    this.ctx.fillStyle = visual.patternColor;
    this.ctx.lineWidth = Math.max(1, bodyWidth * 0.08);

    if (visual.patternType === 'striped' || visual.patternType === 'banded') {
      const stripeCount = visual.patternType === 'banded'
        ? Math.max(2, Math.floor(visual.genome.carnivore.stripeMaskFrequency))
        : Math.max(4, Math.floor(visual.genome.carnivore.stripeMaskFrequency) + 1);
      for (let index = 0; index < stripeCount; index += 1) {
        const offset = ((index + 1) / (stripeCount + 1) - 0.5) * bodyLength;
        this.ctx.beginPath();
        this.ctx.moveTo(x + offset, y - bodyWidth * 0.7);
        this.ctx.lineTo(x + offset, y + bodyWidth * 0.7);
        this.ctx.stroke();
      }
      return;
    }

    const spotCount = Math.max(4, Math.floor(visual.genome.carnivore.spotMaskFrequency));
    for (let index = 0; index < spotCount; index += 1) {
      const spotX = x + (this.random?.range(-0.45, 0.45) ?? 0) * bodyLength;
      const spotY = y + (this.random?.range(-0.6, 0.6) ?? 0) * bodyWidth;
      const spotRadius = bodyWidth * (this.random?.range(0.08, 0.16) ?? 0.1);
      this.ctx.beginPath();
      this.ctx.arc(spotX, spotY, spotRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderLegs(
    x: number,
    y: number,
    size: number,
    visual: CarnivoreVisual,
    stance: number,
    time: number,
  ): void {
    if (!this.ctx) return;

    const legCount = visual.legCount;
    const legLength = size * (0.25 + visual.legLength * 0.4);

    this.ctx.strokeStyle = visual.patternColor;
    this.ctx.lineWidth = Math.max(1, size * 0.06);
    this.ctx.lineCap = 'round';

    for (let index = 0; index < legCount / 2; index += 1) {
      const progress = legCount <= 2 ? 0.5 : index / ((legCount / 2) - 1 || 1);
      const anchorX = x + (progress - 0.5) * stance;
      const phase = time * 7 + index;
      const stepOffset = Math.sin(phase) * size * 0.025;

      this.ctx.beginPath();
      this.ctx.moveTo(anchorX, y);
      this.ctx.lineTo(anchorX - legLength, y + legLength * 0.65 + stepOffset);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(anchorX, y);
      this.ctx.lineTo(anchorX + legLength, y + legLength * 0.65 - stepOffset);
      this.ctx.stroke();
    }
  }

  private renderEyes(
    x: number,
    y: number,
    size: number,
    isHunting: boolean,
  ): void {
    if (!this.ctx) return;

    const eyeDistance = size * 0.15;
    const eyeRadius = size * 0.07;
    const eyeX = x + size * 0.45;
    const eyeY = y - size * 0.1;
    const sclera = isHunting ? '#ffd2d2' : '#ffffff';
    const pupil = isHunting ? '#ff3b30' : '#212529';

    this.ctx.fillStyle = sclera;
    this.ctx.beginPath();
    this.ctx.arc(eyeX, eyeY - eyeDistance * 0.35, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(eyeX, eyeY + eyeDistance * 0.35, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = pupil;
    this.ctx.beginPath();
    this.ctx.arc(eyeX, eyeY - eyeDistance * 0.35, eyeRadius * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(eyeX, eyeY + eyeDistance * 0.35, eyeRadius * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderAura(
    x: number,
    y: number,
    size: number,
    visual: CarnivoreVisual,
    isHunting: boolean,
    healthFactor: number,
    time: number,
  ): void {
    if (!this.ctx) return;

    const shimmerAlpha = visual.stealthShimmer * (0.4 + (1 - healthFactor) * 0.3);
    if (shimmerAlpha > 0.03) {
      this.ctx.save();
      this.ctx.globalAlpha = shimmerAlpha;
      this.ctx.strokeStyle = visual.accentColor;
      this.ctx.lineWidth = Math.max(1, size * 0.04);
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, size * 1.05, size * 0.68, Math.sin(time * 0.8) * 0.03, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    if (!isHunting) return;

    const pulse = 0.8 + Math.sin(time * 3 + visual.visualSeed * 0.0005) * 0.2;
    const auraStrength = visual.huntingAuraStrength * pulse;
    const glowAlpha = Math.min(0.35, auraStrength * 0.35 * (0.5 + visual.eyeGlowIntensity * 0.6));
    if (glowAlpha <= 0.03) return;

    const glow = this.ctx.createRadialGradient(x + size * 0.4, y, 0, x + size * 0.4, y, size * 2.3);
    glow.addColorStop(0, `rgba(255, 90, 90, ${glowAlpha})`);
    glow.addColorStop(1, 'rgba(255, 90, 90, 0)');

    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.4, y, size * 2.3, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
