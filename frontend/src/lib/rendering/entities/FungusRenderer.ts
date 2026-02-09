import type { Entity } from '../../../env.d.ts';
import type { FungusVisual } from '../FungusVisualSystem.ts';

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

export class FungusRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private random: SeededRandom | null = null;

  render(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    visual: FungusVisual,
    x: number,
    y: number,
    time: number,
  ): void {
    this.ctx = ctx;
    this.random = new SeededRandom(this.generateSeed(entity.id));

    const size = this.calculateSize(entity.energy, visual);
    const healthFactor = entity.health / 100;

    switch (visual.fungusType) {
      case 'toadstool':
        this.renderToadstool(x, y, size, visual, healthFactor, time);
        break;
      case 'shelf':
        this.renderShelf(x, y, size, visual, healthFactor, time);
        break;
      case 'puffball':
        this.renderPuffball(x, y, size, visual, healthFactor, time);
        break;
      case 'cluster':
        this.renderCluster(x, y, size, visual, healthFactor, time);
        break;
    }

    this.renderFungusGlow(x, y - size * 0.8, size, visual, healthFactor, time);
    this.renderSporeShimmer(x, y - size * 0.8, size, visual, time);
  }

  private generateSeed(id: string): number {
    const hash = id.split('').reduce((accumulator, character) => {
      return ((accumulator << 5) - accumulator) + character.charCodeAt(0);
    }, 0);
    return Math.abs(hash);
  }

  private calculateSize(energy: number, visual: FungusVisual): number {
    return (7 + energy / 16) * visual.capScale;
  }

  private renderToadstool(
    x: number,
    y: number,
    size: number,
    visual: FungusVisual,
    healthFactor: number,
    time: number,
  ): void {
    if (!this.ctx) return;

    const stemHeight = size * (1.2 + visual.stemScale * 0.3);
    const stemWidth = size * 0.24 * visual.stemScale;
    const capWidth = size * 1.35;
    const capHeight = size * 0.55;
    const sway = Math.sin(time * 1.4 + x * 0.01) * (1.5 + visual.droopFactor * 1.8);

    this.renderStem(x + sway * 0.3, y, stemWidth, stemHeight, visual, healthFactor);
    this.renderCap(x + sway, y - stemHeight, capWidth, capHeight, visual, healthFactor);

    if (visual.hasGills) {
      this.renderGills(x + sway, y - stemHeight, capWidth, capHeight, visual, healthFactor);
    }

    if (visual.hasSpots) {
      this.renderCapSpots(x + sway, y - stemHeight, capWidth, capHeight, visual, healthFactor);
    }

    if (visual.hasRing) {
      this.ctx.strokeStyle = `rgba(245,245,230,${0.5 + healthFactor * 0.3})`;
      this.ctx.lineWidth = Math.max(1, size * 0.05);
      this.ctx.beginPath();
      this.ctx.ellipse(x + sway * 0.4, y - stemHeight * 0.45, stemWidth * 1.2, stemWidth * 0.5, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private renderShelf(
    x: number,
    y: number,
    size: number,
    visual: FungusVisual,
    healthFactor: number,
    time: number,
  ): void {
    if (!this.ctx || !this.random) return;

    const layerCount = Math.max(2, visual.capLayers);
    const baseTilt = Math.sin(time * 0.8 + x * 0.02) * (0.08 + visual.droopFactor * 0.12);

    for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
      const progress = layerIndex / layerCount;
      const width = size * (1.4 - progress * 0.25) * (0.85 + this.random.range(-0.06, 0.08));
      const height = size * (0.38 - progress * 0.04);
      const offsetX = (layerIndex - (layerCount - 1) * 0.5) * size * 0.2;
      const offsetY = -size * 0.45 - layerIndex * size * 0.18;

      this.renderCap(
        x + offsetX,
        y + offsetY,
        width,
        height,
        visual,
        healthFactor,
        baseTilt,
      );

      if (visual.hasGills && layerIndex % 2 === 0) {
        this.renderGills(x + offsetX, y + offsetY, width, height, visual, healthFactor);
      }
    }

    const rootWidth = size * 0.28;
    const rootHeight = size * 0.5;
    this.ctx.fillStyle = this.getStemColor(visual, healthFactor, 0.7);
    this.ctx.beginPath();
    this.ctx.ellipse(x, y - size * 0.2, rootWidth, rootHeight, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderPuffball(
    x: number,
    y: number,
    size: number,
    visual: FungusVisual,
    healthFactor: number,
    time: number,
  ): void {
    if (!this.ctx || !this.random) return;

    const bodyRadius = size * (0.7 + visual.capScale * 0.15);
    const wobble = Math.sin(time * 1.6 + x * 0.02) * (0.8 + visual.droopFactor * 1.2);

    this.ctx.fillStyle = this.getCapColor(visual, healthFactor);
    this.ctx.beginPath();
    this.ctx.ellipse(x + wobble, y - bodyRadius * 0.65, bodyRadius, bodyRadius * 0.82, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = this.getStemColor(visual, healthFactor, 0.8);
    this.ctx.beginPath();
    this.ctx.ellipse(x, y - bodyRadius * 0.05, bodyRadius * 0.36, bodyRadius * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    if (visual.hasSpots) {
      const spotCount = Math.max(3, Math.floor(5 + visual.spotDensity * 7));
      for (let index = 0; index < spotCount; index += 1) {
        const angle = this.random.range(0, Math.PI * 2);
        const radius = this.random.range(bodyRadius * 0.15, bodyRadius * 0.6);
        this.ctx.fillStyle = `rgba(255,255,245,${0.18 + visual.spotDensity * 0.2})`;
        this.ctx.beginPath();
        this.ctx.arc(
          x + wobble + Math.cos(angle) * radius,
          y - bodyRadius * 0.65 + Math.sin(angle) * radius * 0.65,
          Math.max(1, bodyRadius * this.random.range(0.05, 0.1)),
          0,
          Math.PI * 2,
        );
        this.ctx.fill();
      }
    }
  }

  private renderCluster(
    x: number,
    y: number,
    size: number,
    visual: FungusVisual,
    healthFactor: number,
    time: number,
  ): void {
    if (!this.ctx || !this.random) return;

    const count = Math.max(3, visual.clusterCount);
    const spread = size * visual.clusterSpread;

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const offsetRadius = spread * (0.55 + this.random.range(0, 0.45));
      const offsetX = Math.cos(angle) * offsetRadius;
      const offsetY = Math.sin(angle) * offsetRadius * 0.45;
      const mushroomSize = size * this.random.range(0.35, 0.62);
      const bob = Math.sin(time * 1.7 + index + x * 0.01) * (0.5 + visual.droopFactor * 0.8);

      const stemHeight = mushroomSize * (0.95 + visual.stemScale * 0.25);
      this.renderStem(
        x + offsetX,
        y + offsetY,
        mushroomSize * 0.15,
        stemHeight,
        visual,
        healthFactor,
      );

      this.renderCap(
        x + offsetX + bob,
        y + offsetY - stemHeight,
        mushroomSize,
        mushroomSize * 0.45,
        visual,
        healthFactor,
      );
    }
  }

  private renderStem(
    x: number,
    y: number,
    stemWidth: number,
    stemHeight: number,
    visual: FungusVisual,
    healthFactor: number,
  ): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = this.getStemColor(visual, healthFactor, 1);
    this.ctx.beginPath();
    this.ctx.moveTo(x - stemWidth, y);
    this.ctx.quadraticCurveTo(
      x - stemWidth * 0.3,
      y - stemHeight * 0.55,
      x,
      y - stemHeight,
    );
    this.ctx.quadraticCurveTo(
      x + stemWidth * 0.3,
      y - stemHeight * 0.55,
      x + stemWidth,
      y,
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  private renderCap(
    x: number,
    y: number,
    capWidth: number,
    capHeight: number,
    visual: FungusVisual,
    healthFactor: number,
    tilt = 0,
  ): void {
    if (!this.ctx) return;

    const droop = visual.droopFactor * capHeight * 0.25;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(tilt);

    this.ctx.fillStyle = this.getCapColor(visual, healthFactor);
    this.ctx.beginPath();

    if (visual.capShape === 'flat') {
      this.ctx.ellipse(0, droop * 0.2, capWidth * 0.55, capHeight * 0.45, 0, Math.PI, 0, true);
    } else if (visual.capShape === 'conical') {
      this.ctx.moveTo(-capWidth * 0.5, 0);
      this.ctx.quadraticCurveTo(0, -capHeight * 0.95 - droop, capWidth * 0.5, 0);
      this.ctx.quadraticCurveTo(0, capHeight * 0.25, -capWidth * 0.5, 0);
    } else if (visual.capShape === 'lobed') {
      this.ctx.moveTo(-capWidth * 0.5, 0);
      this.ctx.quadraticCurveTo(-capWidth * 0.2, -capHeight * 0.75 - droop, 0, -capHeight * 0.45);
      this.ctx.quadraticCurveTo(capWidth * 0.2, -capHeight * 0.95 - droop, capWidth * 0.5, 0);
      this.ctx.quadraticCurveTo(0, capHeight * 0.28, -capWidth * 0.5, 0);
    } else {
      this.ctx.ellipse(0, 0, capWidth * 0.5, capHeight * 0.6 + droop, 0, Math.PI, 0, true);
    }

    this.ctx.fill();
    this.ctx.restore();
  }

  private renderGills(
    x: number,
    y: number,
    capWidth: number,
    capHeight: number,
    visual: FungusVisual,
    healthFactor: number,
  ): void {
    if (!this.ctx) return;

    const lineCount = 5;
    this.ctx.strokeStyle = this.getGillColor(visual, healthFactor);
    this.ctx.lineWidth = Math.max(0.5, capWidth * 0.015);

    for (let index = -lineCount; index <= lineCount; index += 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(x + index * (capWidth * 0.06), y + capHeight * 0.08);
      this.ctx.lineTo(x + index * (capWidth * 0.04), y + capHeight * 0.4);
      this.ctx.stroke();
    }
  }

  private renderCapSpots(
    x: number,
    y: number,
    capWidth: number,
    capHeight: number,
    visual: FungusVisual,
    healthFactor: number,
  ): void {
    if (!this.ctx || !this.random) return;

    const spotCount = Math.max(3, Math.floor(4 + visual.spotDensity * 7));

    for (let index = 0; index < spotCount; index += 1) {
      const spotX = x + this.random.range(-capWidth * 0.32, capWidth * 0.32);
      const spotY = y - this.random.range(capHeight * 0.05, capHeight * 0.35);
      const spotRadius = capWidth * this.random.range(0.03, 0.09);

      this.ctx.fillStyle = `rgba(245,245,235,${0.2 + healthFactor * 0.35})`;
      this.ctx.beginPath();
      this.ctx.arc(spotX, spotY, spotRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderFungusGlow(
    x: number,
    y: number,
    size: number,
    visual: FungusVisual,
    healthFactor: number,
    time: number,
  ): void {
    if (!this.ctx || visual.glowIntensity <= 0.05) return;

    const pulse = 0.75 + Math.sin(time * 2.2 + visual.visualSeed * 0.001) * 0.25;
    const alpha = Math.min(0.5, visual.glowIntensity * 0.28 * pulse * (0.6 + healthFactor * 0.5));
    const glow = this.ctx.createRadialGradient(x, y, 0, x, y, size * 1.8);
    glow.addColorStop(0, `rgba(174, 132, 220, ${alpha})`);
    glow.addColorStop(1, 'rgba(174, 132, 220, 0)');

    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 1.8, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderSporeShimmer(
    x: number,
    y: number,
    size: number,
    visual: FungusVisual,
    time: number,
  ): void {
    if (!this.ctx || !this.random || visual.sporeIntensity <= 0.15) return;

    const sporeCount = Math.min(8, Math.max(2, Math.floor(visual.sporeIntensity * 6)));

    for (let index = 0; index < sporeCount; index += 1) {
      const angle = (index / sporeCount) * Math.PI * 2 + time * 0.45;
      const distance = size * (0.7 + this.random.range(0, 0.6));
      const sporeX = x + Math.cos(angle) * distance;
      const sporeY = y + Math.sin(angle) * distance * 0.75;
      const radius = this.random.range(0.7, 1.8);

      this.ctx.fillStyle = `rgba(230, 245, 190, ${Math.min(0.45, 0.08 + visual.sporeIntensity * 0.2)})`;
      this.ctx.beginPath();
      this.ctx.arc(sporeX, sporeY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private getCapColor(visual: FungusVisual, healthFactor: number): string {
    const hue = (280 + visual.baseHueOffset + 360) % 360;
    const saturation = Math.max(20, Math.min(75, 42 + visual.saturationOffset - visual.decayFactor * 14));
    const lightness = Math.max(25, Math.min(72, 52 + visual.lightnessOffset + (1 - healthFactor) * 8));
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  private getStemColor(visual: FungusVisual, healthFactor: number, opacity: number): string {
    const hue = (34 + visual.baseHueOffset * 0.15 + 360) % 360;
    const saturation = Math.max(8, Math.min(35, 18 + visual.saturationOffset * 0.2));
    const lightness = Math.max(55, Math.min(90, 78 - visual.decayFactor * 10 + healthFactor * 4));
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
  }

  private getGillColor(visual: FungusVisual, healthFactor: number): string {
    const hue = (20 + visual.baseHueOffset * 0.1 + 360) % 360;
    const saturation = Math.max(10, Math.min(35, 20 + visual.saturationOffset * 0.15));
    const lightness = Math.max(42, Math.min(80, 64 - visual.decayFactor * 12 + healthFactor * 6));
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
}
