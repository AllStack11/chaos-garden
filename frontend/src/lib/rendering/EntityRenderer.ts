/**
 * EntityRenderer - Main Rendering Engine for Chaos Garden
 * 
 * Renders all entity types with detailed procedural visuals,
 * health/energy animations, and biological behaviors.
 */

import type { Entity } from '../../../env.d.ts';
import { 
  generateEntityColors, 
  getHealthAdjustedColor, 
  getNightColor,
  getDeathColor,
  type EntityColors 
} from './utils/colors.ts';
import {
  drawLeaf,
  drawFlower,
  drawMushroomCap,
  drawInsectBody,
  drawCreatureLegs,
  drawWings,
  drawAntenna,
  drawEye,
  drawStem,
  type ShapeOptions
} from './utils/shapes.ts';
import {
  breathingAnimation,
  wingFlapAnimation,
  plantSwayAnimation,
  heliotropismAnimation,
  walkBobAnimation,
  happyWiggleAnimation,
  antennaWaveAnimation,
  scalePulseAnimation,
  growthAnimation,
  easeOutElastic,
  easeInOutSine
} from './utils/animations.ts';
import {
  ParticleSystem,
  createSpore,
  createEatParticles,
  createDeathParticles,
  createBirthParticles,
  createGlow,
  createMyceliumParticle,
  createSparkles
} from './utils/particles.ts';

// ==========================================
// Configuration
// ==========================================

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
  lodDistance: 50
};

// ==========================================
// Entity Renderer Class
// ==========================================

export class EntityRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private particleSystem: ParticleSystem;
  private entityColors: Map<string, EntityColors> = new Map();
  private config: EntityRendererConfig;
  private lastFrameTime: number = 0;
  private time: number = 0;

  constructor(config: Partial<EntityRendererConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.particleSystem = new ParticleSystem();
  }

  /**
   * Initialize the renderer with a canvas context
   */
  initialize(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
  }

  /**
   * Set the rendering configuration
   */
  setConfig(config: Partial<EntityRendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update time and particles
   */
  update(deltaTime: number): void {
    this.time += deltaTime;
    this.particleSystem.update(deltaTime);
  }

  /**
   * Render all entities
   */
  render(
    entities: Entity[],
    selectedEntity: Entity | null,
    isNight: boolean,
    sunlight: number
  ): void {
    if (!this.ctx) return;

    // Render particles first (behind entities)
    this.particleSystem.render(this.ctx);

    // Sort entities by y-position for depth
    const sortedEntities = [...entities].sort((a, b) => a.position.y - b.position.y);

    // Render each entity
    for (const entity of sortedEntities) {
      this.renderEntity(entity, selectedEntity, isNight, sunlight);
    }
  }

  /**
   * Render a single entity
   */
  private renderEntity(
    entity: Entity,
    selectedEntity: Entity | null,
    isNight: boolean,
    sunlight: number
  ): void {
    if (!this.ctx || !entity.isAlive) return;

    const isSelected = selectedEntity?.id === entity.id;
    const scale = this.getEntityScale(entity);
    const colors = this.getEntityColors(entity);
    const healthColors = getHealthAdjustedColor(colors, entity.health, entity.energy);
    const nightColors = getNightColor(colors, isNight, this.isNocturnal(entity));

    // Get screen position
    const screenX = entity.position.x;
    const screenY = entity.position.y;

    // Render based on entity type
    switch (entity.type) {
      case 'plant':
        this.renderPlant(entity, screenX, screenY, scale, colors, healthColors, nightColors, isSelected, sunlight);
        break;
      case 'herbivore':
        this.renderHerbivore(entity, screenX, screenY, scale, colors, healthColors, nightColors, isSelected);
        break;
      case 'carnivore':
        this.renderCarnivore(entity, screenX, screenY, scale, colors, healthColors, nightColors, isSelected);
        break;
      case 'fungus':
        this.renderFungus(entity, screenX, screenY, scale, colors, healthColors, nightColors, isSelected);
        break;
    }

    // Render selection highlight
    if (isSelected && this.config.showSelectionHighlight) {
      this.renderSelectionHighlight(screenX, screenY, scale, entity);
    }

    // Render name tag
    if (this.config.showNames || isSelected) {
      this.renderNameTag(entity, screenX, screenY, scale, isSelected);
    }

    // Render health bar
    if (this.config.showHealthBars) {
      this.renderHealthBar(entity, screenX, screenY, scale);
    }
  }

  /**
   * Render a plant entity
   */
  private renderPlant(
    entity: Entity,
    x: number,
    y: number,
    scale: number,
    colors: EntityColors,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
    isSelected: boolean,
    sunlight: number
  ): void {
    if (!this.ctx) return;

    const time = this.time;
    const healthFactor = entity.health / 100;
    const energyFactor = entity.energy / 100;

    // Calculate animations
    const sway = plantSwayAnimation(x, time);
    const heliotropism = heliotropismAnimation(sunlight, time);
    const breath = breathingAnimation(time, 1, 0.1);
    const growthProgress = Math.min(entity.age / 50, 1); // Grows in first 50 ticks
    const growthScale = growthAnimation(growthProgress, easeOutElastic) * scale;

    // Size based on energy and growth
    const baseSize = 8 + (energyFactor * 8) + (growthScale * 4);
    const petalCount = 5 + Math.floor(entity.age % 10); // Varied petals based on age

    // Draw stem
    const stemHeight = baseSize * 2;
    drawStem(
      this.ctx,
      x,
      y,
      stemHeight,
      sway * 10,
      2 * growthScale,
      { fill: '#166534', stroke: '#14532d' }
    );

    // Draw flower/leaf
    const flowerY = y - stemHeight;
    drawFlower(
      this.ctx,
      x + sway * 5,
      flowerY,
      petalCount,
      baseSize * 1.5,
      baseSize * 0.4,
      baseSize * 0.3,
      {
        fill: nightColors.fill,
        stroke: healthColors.stroke,
        scale: growthScale,
        opacity: 0.7 + breath * 0.3 + energyFactor * 0.3
      }
    );

    // High energy glow effect
    if (energyFactor > 0.7) {
      this.ctx.save();
      const glow = this.ctx.createRadialGradient(x, flowerY, 0, x, flowerY, baseSize * 3);
      glow.addColorStop(0, nightColors.glow);
      glow.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glow;
      this.ctx.beginPath();
      this.ctx.arc(x, flowerY, baseSize * 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Low health droop
    if (healthFactor < 0.5) {
      // Draw drooping effect (no code needed, just visual representation)
    }
  }

  /**
   * Render a herbivore entity
   */
  private renderHerbivore(
    entity: Entity,
    x: number,
    y: number,
    scale: number,
    colors: EntityColors,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
    isSelected: boolean
  ): void {
    if (!this.ctx) return;

    const time = this.time;
    const healthFactor = entity.health / 100;
    const energyFactor = entity.energy / 100;

    // Calculate animations
    const flapPhase = wingFlapAnimation(time, 5);
    const bob = walkBobAnimation(time, 8);
    const wiggle = energyFactor > 0.8 ? happyWiggleAnimation(time, 1) : 0;
    const antennaAngle = antennaWaveAnimation(time, 2);

    // Body dimensions
    const bodyLength = (12 + energyFactor * 8) * scale;
    const bodyWidth = (6 + healthFactor * 4) * scale;
    const yOffset = y - bob;

    // Draw wings (behind body)
    const wingY = yOffset - bodyWidth * 0.3;
    drawWings(
      this.ctx,
      x,
      wingY,
      bodyLength * 1.2,
      bodyWidth * 0.8,
      flapPhase,
      nightColors.fill,
      { opacity: 0.6 }
    );

    // Draw legs
    drawCreatureLegs(
      this.ctx,
      x,
      yOffset,
      bodyLength,
      bodyWidth * 2,
      6,
      time * 8,
      { stroke: healthColors.stroke, scale }
    );

    // Draw body
    drawInsectBody(
      this.ctx,
      x,
      yOffset,
      bodyLength,
      bodyWidth,
      4,
      {
        fill: nightColors.fill,
        stroke: healthColors.stroke,
        scale,
        rotation: wiggle
      }
    );

    // Draw antenna (pointing curious direction)
    const headX = x + bodyLength * 0.7;
    const headY = yOffset - bodyWidth * 0.2;
    drawAntenna(
      this.ctx,
      headX,
      headY,
      bodyWidth * 1.5,
      -Math.PI / 2 + antennaAngle,
      3,
      { stroke: healthColors.stroke, opacity: 0.8 }
    );

    // Draw eyes
    const eyeRadius = bodyWidth * 0.25;
    drawEye(this.ctx, headX + bodyWidth * 0.3, headY - bodyWidth * 0.1, eyeRadius, false, {
      fill: 'white',
      stroke: '#333'
    });
    drawEye(this.ctx, headX + bodyWidth * 0.3, headY + bodyWidth * 0.1, eyeRadius, false, {
      fill: 'white',
      stroke: '#333'
    });

    // Draw glow for high energy
    if (energyFactor > 0.7) {
      this.ctx.save();
      const glow = this.ctx.createRadialGradient(x, yOffset, 0, x, yOffset, bodyLength * 2);
      glow.addColorStop(0, nightColors.glow);
      glow.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glow;
      this.ctx.beginPath();
      this.ctx.arc(x, yOffset, bodyLength * 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  /**
   * Render a carnivore entity
   */
  private renderCarnivore(
    entity: Entity,
    x: number,
    y: number,
    scale: number,
    colors: EntityColors,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
    isSelected: boolean
  ): void {
    if (!this.ctx) return;

    const time = this.time;
    const healthFactor = entity.health / 100;
    const energyFactor = entity.energy / 100;
    const isHunting = energyFactor < 0.5;

    // Calculate animations
    const bob = walkBobAnimation(time, 8);
    const tailSway = Math.sin(time * 3) * 0.2;

    // Body dimensions (larger than herbivores)
    const bodyLength = (16 + energyFactor * 10) * scale;
    const bodyWidth = (10 + healthFactor * 5) * scale;
    const yOffset = y - bob;

    // Draw tail
    this.ctx.save();
    this.ctx.strokeStyle = healthColors.stroke;
    this.ctx.lineWidth = 3 * scale;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x - bodyLength * 0.4, yOffset);
    this.ctx.quadraticCurveTo(
      x - bodyLength * 0.8,
      yOffset + tailSway * 20,
      x - bodyLength,
      yOffset + tailSway * 10
    );
    this.ctx.stroke();
    this.ctx.restore();

    // Draw body (elongated for predators)
    drawInsectBody(
      this.ctx,
      x,
      yOffset,
      bodyLength,
      bodyWidth,
      5,
      {
        fill: nightColors.fill,
        stroke: healthColors.stroke,
        scale
      }
    );

    // Draw legs (fewer but longer for predators)
    drawCreatureLegs(
      this.ctx,
      x,
      yOffset,
      bodyLength,
      bodyWidth * 2.5,
      4, // 4 legs for predators
      time * 10,
      { stroke: healthColors.stroke, scale }
    );

    // Draw head
    const headX = x + bodyLength * 0.6;
    const headY = yOffset - bodyWidth * 0.1;
    const headSize = bodyWidth * 0.7;

    // Head
    this.ctx.beginPath();
    this.ctx.ellipse(headX, headY, headSize, headSize * 0.6, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = nightColors.fill;
    this.ctx.fill();
    this.ctx.strokeStyle = healthColors.stroke;
    this.ctx.stroke();

    // Predatory eyes (red when hunting)
    const eyeRadius = headSize * 0.3;
    drawEye(this.ctx, headX + headSize * 0.4, headY - headSize * 0.15, eyeRadius, isHunting, {
      fill: isHunting ? '#ffcccc' : 'white',
      stroke: '#333'
    });

    // Snout
    this.ctx.beginPath();
    this.ctx.ellipse(headX + headSize * 0.6, headY + headSize * 0.1, headSize * 0.5, headSize * 0.3, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = colors.base.h > 20 ? colors.accent.fill : healthColors.fill;
    this.ctx.fill();

    // Hunting glow
    if (isHunting) {
      this.ctx.save();
      const glow = this.ctx.createRadialGradient(x, yOffset, 0, x, yOffset, bodyLength * 2.5);
      glow.addColorStop(0, 'rgba(255, 100, 100, 0.3)');
      glow.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glow;
      this.ctx.beginPath();
      this.ctx.arc(x, yOffset, bodyLength * 2.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  /**
   * Render a fungus entity
   */
  private renderFungus(
    entity: Entity,
    x: number,
    y: number,
    scale: number,
    colors: EntityColors,
    healthColors: { fill: string; stroke: string },
    nightColors: { fill: string; glow: string },
    isSelected: boolean
  ): void {
    if (!this.ctx) return;

    const time = this.time;
    const healthFactor = entity.health / 100;
    const energyFactor = entity.energy / 100;
    const isNight = time % 10 > 5; // Simplified night detection

    // Calculate animations
    const breath = breathingAnimation(time, 0.5, 0.2);
    const glowPulse = isNight ? breathingAnimation(time, 1, 0.5) : 0;

    // Size based on energy
    const capWidth = (12 + energyFactor * 10) * scale;
    const capHeight = capWidth * 0.5;
    const stemHeight = (6 + healthFactor * 4) * scale;
    const stemWidth = capWidth * 0.2;

    // Draw stem
    this.ctx.beginPath();
    this.ctx.moveTo(x - stemWidth / 2, y);
    this.ctx.quadraticCurveTo(-stemWidth / 3, y - stemHeight / 2, -stemWidth / 4, y - stemHeight);
    this.ctx.lineTo(stemWidth / 4, y - stemHeight);
    this.ctx.quadraticCurveTo(stemWidth / 3, y - stemHeight / 2, stemWidth / 2, y);
    this.ctx.fillStyle = '#f5f5f5';
    this.ctx.globalAlpha = 0.8;
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
    this.ctx.strokeStyle = healthColors.stroke;
    this.ctx.stroke();

    // Draw cap
    drawMushroomCap(
      this.ctx,
      x,
      y - stemHeight,
      capWidth,
      capHeight,
      stemHeight,
      stemWidth,
      {
        fill: nightColors.fill,
        stroke: healthColors.stroke,
        scale
      }
    );

    // Bioluminescent glow at night
    if (isNight) {
      this.ctx.save();
      const glowIntensity = 0.3 + glowPulse * 0.4 +