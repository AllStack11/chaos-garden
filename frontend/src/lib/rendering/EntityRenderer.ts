/**
 * EntityRenderer - Main Rendering Engine for Chaos Garden
 *
 * Renders entities with lightweight procedural visuals and optional overlays.
 */

import type { Entity } from '../../env.d.ts';
import {
  generateEntityColors,
  getHealthAdjustedColor,
  getNightColor,
  type EntityColors,
} from './utils/colors.ts';
import {
  drawFlower,
  drawMushroomCap,
  drawInsectBody,
  drawCreatureLegs,
  drawWings,
  drawAntenna,
  drawEye,
  drawStem,
} from './utils/shapes.ts';
import {
  breathingAnimation,
  wingFlapAnimation,
  plantSwayAnimation,
  walkBobAnimation,
  antennaWaveAnimation,
  growthAnimation,
  easeOutElastic,
} from './utils/animations.ts';
import {
  ParticleSystem,
  createSpore,
  createGlow,
  createMyceliumParticle,
  createSparkles,
} from './utils/particles.ts';

export interface EntityRendererConfig {
  showNames: boolean;
  showHealthBars: boolean;
  showSelectionHighlight: boolean;
  particleIntensity: number;
  lodDistance: number;
}

const DEFAULT_CONFIG: EntityRendererConfig = {
  showNames: true,
  showHealthBars: true,
  showSelectionHighlight: true,
  particleIntensity: 1,
  lodDistance: 50,
};

export class EntityRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private particleSystem = new ParticleSystem();
  private entityColors: Map<string, EntityColors> = new Map();
  private config: EntityRendererConfig;
  private time = 0;

  constructor(config: Partial<EntityRendererConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initialize(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
  }

  setConfig(config: Partial<EntityRendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
    this.particleSystem.update(deltaTime);
  }

  render(
    entities: Entity[],
    selectedEntity: Entity | null,
    isNight: boolean,
    sunlight: number,
  ): void {
    if (!this.ctx) return;

    this.particleSystem.render(this.ctx);

    const sortedEntities = [...entities].sort((left, right) => left.position.y - right.position.y);
    sortedEntities.forEach((entity) => {
      this.renderEntity(entity, selectedEntity, isNight, sunlight);
    });
  }

  private renderEntity(
    entity: Entity,
    selectedEntity: Entity | null,
    isNight: boolean,
    sunlight: number,
  ): void {
    if (!this.ctx || !entity.isAlive) return;

    const isSelected = selectedEntity?.id === entity.id;
    const scale = this.getEntityScale(entity);
    const colors = this.getEntityColors(entity);
    const healthColors = getHealthAdjustedColor(colors, entity.health, entity.energy);
    const nightColors = getNightColor(colors, isNight, this.isNocturnal(entity));

    const screenX = entity.position.x;
    const screenY = entity.position.y;

    switch (entity.type) {
      case 'plant':
        this.renderPlant(entity, screenX, screenY, scale, healthColors, nightColors, sunlight);
        break;
      case 'herbivore':
        this.renderHerbivore(entity, screenX, screenY, scale, healthColors, nightColors);
        break;
      case 'carnivore':
        this.renderCarnivore(entity, screenX, screenY, scale, healthColors, nightColors);
        break;
      case 'fungus':
        this.renderFungus(entity, screenX, screenY, scale, healthColors, nightColors, isNight);
        break;
    }

    if (isSelected && this.config.showSelectionHighlight) {
      this.renderSelectionHighlight(screenX, screenY, scale, entity);
    }

    if (this.config.showNames || isSelected) {
      this.renderNameTag(entity, screenX, screenY, scale, isSelected);
    }

    if (this.config.showHealthBars) {
      this.renderHealthBar(entity, screenX, screenY, scale);
    }
  }

  private renderPlant(
    entity: Extract<Entity, { type: 'plant' }>,
    x: number,
    y: number,
    scale: number,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
    sunlight: number,
  ): void {
    if (!this.ctx) return;

    const energyFactor = entity.energy / 100;
    const growthProgress = Math.min(entity.age / 50, 1);
    const growthScale = growthAnimation(growthProgress, easeOutElastic) * scale;

    const sway = plantSwayAnimation(x, this.time, sunlight);
    const breath = breathingAnimation(this.time, 1, 0.1);
    const baseSize = 7 + energyFactor * 8;
    const stemHeight = baseSize * 2;

    drawStem(this.ctx, x, y, stemHeight, sway * 10, 2 * growthScale, {
      fill: '#166534',
      stroke: healthColors.stroke,
    });

    drawFlower(
      this.ctx,
      x + sway * 3,
      y - stemHeight,
      5 + Math.floor(entity.age % 6),
      baseSize * 1.2,
      baseSize * 0.4,
      baseSize * 0.35,
      {
        fill: nightColors.fill,
        stroke: healthColors.stroke,
        scale: growthScale,
        opacity: 0.75 + breath * 0.2,
      },
    );

    if (energyFactor > 0.75 && Math.random() < 0.01 * this.config.particleIntensity) {
      this.particleSystem.addParticle(createGlow(x, y - stemHeight, baseSize * 0.8, nightColors.glow));
    }
  }

  private renderHerbivore(
    entity: Extract<Entity, { type: 'herbivore' }>,
    x: number,
    y: number,
    scale: number,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
  ): void {
    if (!this.ctx) return;

    const healthFactor = entity.health / 100;
    const bodyLength = (12 + (entity.energy / 100) * 7) * scale;
    const bodyWidth = (6 + healthFactor * 4) * scale;
    const yOffset = y - walkBobAnimation(this.time, 8);

    drawWings(this.ctx, x, yOffset - bodyWidth * 0.2, bodyLength, bodyWidth, wingFlapAnimation(this.time, 6), nightColors.fill, {
      opacity: 0.6,
    });

    drawCreatureLegs(this.ctx, x, yOffset, bodyLength, bodyWidth * 1.8, 6, this.time * 8, {
      stroke: healthColors.stroke,
      scale,
    });

    drawInsectBody(this.ctx, x, yOffset, bodyLength, bodyWidth, 4, {
      fill: nightColors.fill,
      stroke: healthColors.stroke,
      scale,
    });

    const headX = x + bodyLength * 0.7;
    const headY = yOffset - bodyWidth * 0.2;
    drawAntenna(this.ctx, headX, headY, bodyWidth * 1.3, -Math.PI / 2 + antennaWaveAnimation(this.time, 2), 2, {
      stroke: healthColors.stroke,
    });
    drawEye(this.ctx, headX + bodyWidth * 0.2, headY, bodyWidth * 0.2, false, {
      fill: 'white',
      stroke: '#333',
    });
  }

  private renderCarnivore(
    entity: Extract<Entity, { type: 'carnivore' }>,
    x: number,
    y: number,
    scale: number,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
  ): void {
    if (!this.ctx) return;

    const energyFactor = entity.energy / 100;
    const isHunting = energyFactor < 0.5;
    const bodyLength = (16 + energyFactor * 10) * scale;
    const bodyWidth = (9 + (entity.health / 100) * 4) * scale;
    const yOffset = y - walkBobAnimation(this.time, 7);

    drawInsectBody(this.ctx, x, yOffset, bodyLength, bodyWidth, 5, {
      fill: nightColors.fill,
      stroke: healthColors.stroke,
    });

    drawCreatureLegs(this.ctx, x, yOffset, bodyLength, bodyWidth * 2.2, 4, this.time * 10, {
      stroke: healthColors.stroke,
    });

    const headX = x + bodyLength * 0.6;
    const headY = yOffset - bodyWidth * 0.15;
    drawEye(this.ctx, headX, headY, bodyWidth * 0.25, isHunting, {
      fill: isHunting ? '#ffcccc' : 'white',
      stroke: '#333',
    });

    if (isHunting && Math.random() < 0.01 * this.config.particleIntensity) {
      this.particleSystem.addParticle(createGlow(x, yOffset, bodyLength * 0.3, 'rgba(255, 100, 100, 0.35)'));
    }
  }

  private renderFungus(
    entity: Extract<Entity, { type: 'fungus' }>,
    x: number,
    y: number,
    scale: number,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
    isNight: boolean,
  ): void {
    if (!this.ctx) return;

    const capWidth = (11 + (entity.energy / 100) * 8) * scale;
    const capHeight = capWidth * 0.5;
    const stemHeight = (6 + (entity.health / 100) * 4) * scale;

    drawMushroomCap(this.ctx, x, y - stemHeight, capWidth, capHeight, stemHeight, capWidth * 0.2, {
      fill: nightColors.fill,
      stroke: healthColors.stroke,
    });

    if (isNight && Math.random() < 0.015 * this.config.particleIntensity) {
      this.particleSystem.addParticle(createSpore(x, y - stemHeight, nightColors.glow));
    }

    if (Math.random() < 0.008 * this.config.particleIntensity) {
      this.particleSystem.addParticle(createMyceliumParticle(x, y));
    }
  }

  private getEntityScale(entity: Entity): number {
    const energyScale = 0.8 + (entity.energy / 100) * 0.5;
    const healthScale = 0.85 + (entity.health / 100) * 0.3;
    return Math.max(0.5, Math.min(1.8, (energyScale + healthScale) / 2));
  }

  private getEntityColors(entity: Entity): EntityColors {
    const cached = this.entityColors.get(entity.id);
    if (cached) return cached;

    const generated = generateEntityColors(entity.species, entity.type);
    this.entityColors.set(entity.id, generated);
    return generated;
  }

  private isNocturnal(entity: Entity): boolean {
    return entity.type === 'fungus' || entity.type === 'carnivore';
  }

  private renderSelectionHighlight(x: number, y: number, scale: number, entity: Entity): void {
    if (!this.ctx) return;

    const radius = (8 + entity.energy / 20) * scale;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderNameTag(
    entity: Entity,
    x: number,
    y: number,
    scale: number,
    isSelected: boolean,
  ): void {
    if (!this.ctx) return;

    const labelY = y - 22 * scale;
    this.ctx.save();
    this.ctx.font = isSelected ? 'bold 12px sans-serif' : '10px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const textWidth = this.ctx.measureText(entity.name).width;
    const boxWidth = textWidth + 10;
    const boxHeight = 16;

    this.ctx.fillStyle = isSelected ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)';
    this.ctx.beginPath();
    this.ctx.roundRect(x - boxWidth / 2, labelY - boxHeight / 2, boxWidth, boxHeight, 4);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.ctx.fillText(entity.name, x, labelY);
    this.ctx.restore();
  }

  private renderHealthBar(entity: Entity, x: number, y: number, scale: number): void {
    if (!this.ctx) return;

    const width = 28 * scale;
    const height = 4;
    const barX = x - width / 2;
    const barY = y + 14 * scale;
    const healthRatio = Math.max(0, Math.min(1, entity.health / 100));

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.fillRect(barX, barY, width, height);

    this.ctx.fillStyle = healthRatio > 0.5 ? '#22c55e' : healthRatio > 0.25 ? '#f59e0b' : '#ef4444';
    this.ctx.fillRect(barX, barY, width * healthRatio, height);
    this.ctx.restore();

    if (entity.energy > 90 && Math.random() < 0.004 * this.config.particleIntensity) {
      this.particleSystem.addParticle(createSparkles(x, y - 8 * scale, 1)[0]);
    }
  }
}
