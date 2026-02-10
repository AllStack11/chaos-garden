import type { Entity } from '../../../env.d.ts';
import { PlantRenderer } from '../../rendering/entities/PlantRenderer.ts';
import { HerbivoreRenderer } from '../../rendering/entities/HerbivoreRenderer.ts';
import { FungusRenderer } from '../../rendering/entities/FungusRenderer.ts';
import { CarnivoreRenderer } from '../../rendering/entities/CarnivoreRenderer.ts';
import { getPlantVisual } from '../../rendering/PlantVisualSystem.ts';
import { getHerbivoreVisual } from '../../rendering/HerbivoreVisualSystem.ts';
import { getFungusVisual } from '../../rendering/FungusVisualSystem.ts';
import { getCarnivoreVisual } from '../../rendering/CarnivoreVisualSystem.ts';
import type { EntityRenderConfig } from './types.ts';
import type { RuntimeVisualState } from '../../rendering/types.ts';

interface PlantVisualEntity {
  id: string;
  name: string;
  species: string;
  health: number;
  energy: number;
  position: { x: number; y: number };
  traits: {
    photosynthesisRate: number;
    reproductionRate: number;
    metabolismEfficiency: number;
  };
}

interface HerbivoreVisualEntity {
  id: string;
  name: string;
  species: string;
  health: number;
  energy: number;
  position: { x: number; y: number };
  traits: {
    reproductionRate: number;
    movementSpeed: number;
    metabolismEfficiency: number;
    perceptionRadius: number;
  };
}

interface FungusVisualEntity {
  id: string;
  name: string;
  species: string;
  health: number;
  energy: number;
  position: { x: number; y: number };
  traits: {
    reproductionRate: number;
    metabolismEfficiency: number;
    decompositionRate: number;
    perceptionRadius: number;
  };
}

interface CarnivoreVisualEntity {
  id: string;
  name: string;
  species: string;
  health: number;
  energy: number;
  position: { x: number; y: number };
  traits: {
    reproductionRate: number;
    movementSpeed: number;
    metabolismEfficiency: number;
    perceptionRadius: number;
  };
}

type BehaviorState = 'idle' | 'move' | 'forage' | 'hunt' | 'flee' | 'recover';

interface EntityMotionSnapshot {
  lastX: number;
  lastY: number;
  lastEnergy: number;
  lastTimestamp: number;
  behavior: BehaviorState;
  phaseOffset: number;
  speed: number;
}

interface PreparedEntity {
  entity: Entity;
  x: number;
  y: number;
  scale: number;
  radius: number;
  runtime: RuntimeVisualState;
  behavior: BehaviorState;
  motionSpeed: number;
  animationTime: number;
}

export class GardenEntityRenderer {
  private readonly plantRenderer = new PlantRenderer();
  private readonly herbivoreRenderer = new HerbivoreRenderer();
  private readonly fungusRenderer = new FungusRenderer();
  private readonly carnivoreRenderer = new CarnivoreRenderer();
  private readonly motionSnapshots = new Map<string, EntityMotionSnapshot>();
  private preparedEntitiesCache: PreparedEntity[] = [];
  private preparedEntitiesCacheTimestamp = -1;
  private preparedEntitiesSource: Entity[] | null = null;

  renderEntityShadows(
    ctx: CanvasRenderingContext2D,
    entities: Entity[],
    config: EntityRenderConfig,
  ): void {
    const preparedEntities = this.prepareEntities(entities, config);

    preparedEntities.forEach((prepared) => {
      if (!prepared.entity.isAlive) return;

      const shadowDirectionX = Math.cos(config.lighting.sunDirection + Math.PI);
      const shadowDirectionY = Math.sin(config.lighting.sunDirection + Math.PI);
      const shadowLength = 8 + (1 - config.lighting.sunlight) * 18;

      ctx.save();
      ctx.fillStyle = `rgba(3, 8, 6, ${0.08 + config.lighting.shadowStrength * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(
        prepared.x + shadowDirectionX * shadowLength,
        prepared.y + shadowDirectionY * shadowLength,
        prepared.radius * 0.9,
        prepared.radius * 0.35,
        shadowDirectionX * 0.25,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    });
  }

  renderEntitiesBase(
    ctx: CanvasRenderingContext2D,
    entities: Entity[],
    config: EntityRenderConfig,
  ): void {
    const preparedEntities = this.prepareEntities(entities, config);

    preparedEntities.forEach((prepared) => {
      this.renderEntityBase(ctx, prepared, config);
    });
  }

  renderEntityOverlays(
    ctx: CanvasRenderingContext2D,
    entities: Entity[],
    config: EntityRenderConfig,
  ): void {
    const preparedEntities = this.prepareEntities(entities, config);

    preparedEntities.forEach((prepared) => {
      if (!prepared.entity.isAlive) return;

      this.drawStateOverlay(ctx, prepared, config);

      const isHovered = config.hoveredEntity?.id === prepared.entity.id;
      const isSelected = config.selectedEntity?.id === prepared.entity.id;

      if (isHovered) {
        this.drawNameTag(ctx, prepared.entity.name, prepared.x, prepared.y - prepared.radius - 15, false);
      }

      if (isSelected) {
        drawSelectionRing(ctx, prepared.x, prepared.y, prepared.radius);
        this.drawNameTag(ctx, prepared.entity.name, prepared.x, prepared.y - prepared.radius - 30, true);
      }
    });
  }

  private prepareEntities(
    entities: Entity[],
    config: EntityRenderConfig,
  ): PreparedEntity[] {
    if (
      this.preparedEntitiesCacheTimestamp === config.frameTimestampMs &&
      this.preparedEntitiesSource === entities
    ) {
      return this.preparedEntitiesCache;
    }

    const now = config.frameTimestampMs;
    const sortedEntities = [...entities].sort((left, right) => left.position.y - right.position.y);

    const preparedEntities = sortedEntities.map((entity) => {
      const { x, y, scale } = config.worldToScreen(entity.position.x, entity.position.y);
      const radius = config.calculateEntitySize(entity.energy) * scale;
      const motion = this.updateMotionSnapshot(entity, now);
      const runtime = buildRuntimeVisualState(entity, config);

      return {
        entity,
        x,
        y,
        scale,
        radius,
        runtime,
        behavior: motion.behavior,
        motionSpeed: motion.speed,
        animationTime: now / 1000 + motion.phaseOffset,
      };
    });

    this.preparedEntitiesCache = preparedEntities;
    this.preparedEntitiesCacheTimestamp = config.frameTimestampMs;
    this.preparedEntitiesSource = entities;
    return preparedEntities;
  }

  private updateMotionSnapshot(entity: Entity, now: number): EntityMotionSnapshot {
    const previous = this.motionSnapshots.get(entity.id);
    const phaseOffset = previous?.phaseOffset ?? this.calculateEntityPhaseOffset(entity.id);

    if (!previous) {
      const snapshot: EntityMotionSnapshot = {
        lastX: entity.position.x,
        lastY: entity.position.y,
        lastEnergy: entity.energy,
        lastTimestamp: now,
        behavior: 'idle',
        phaseOffset,
        speed: 0,
      };
      this.motionSnapshots.set(entity.id, snapshot);
      return snapshot;
    }

    const dt = Math.max(16, now - previous.lastTimestamp) / 1000;
    const deltaX = entity.position.x - previous.lastX;
    const deltaY = entity.position.y - previous.lastY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const speed = distance / dt;
    const energyDelta = entity.energy - previous.lastEnergy;

    const nextSnapshot: EntityMotionSnapshot = {
      ...previous,
      lastX: entity.position.x,
      lastY: entity.position.y,
      lastEnergy: entity.energy,
      lastTimestamp: now,
      speed,
      behavior: this.inferBehavior(entity, speed, energyDelta),
    };

    this.motionSnapshots.set(entity.id, nextSnapshot);
    return nextSnapshot;
  }

  private inferBehavior(entity: Entity, speed: number, energyDelta: number): BehaviorState {
    if (entity.health < 30) return 'recover';

    if (entity.type === 'carnivore') {
      if (speed > 8) return 'hunt';
      if (energyDelta < -1.5) return 'forage';
      return speed > 2 ? 'move' : 'idle';
    }

    if (entity.type === 'herbivore') {
      if (speed > 9) return 'flee';
      if (energyDelta < -1.2) return 'forage';
      return speed > 2 ? 'move' : 'idle';
    }

    if (entity.type === 'fungus') {
      return energyDelta > 0.2 ? 'forage' : 'idle';
    }

    if (entity.type === 'plant') {
      return entity.health < 40 ? 'recover' : 'idle';
    }

    return 'idle';
  }

  private renderEntityBase(
    ctx: CanvasRenderingContext2D,
    prepared: PreparedEntity,
    config: EntityRenderConfig,
  ): void {
    if (!prepared.entity.isAlive) {
      this.drawDeadEntityCarcass(ctx, prepared);
      return;
    }

    ctx.save();
    this.applyTypeMotionTransform(ctx, prepared, config);

    switch (prepared.entity.type) {
      case 'plant':
        this.drawPlantEntity(ctx, prepared.entity, prepared.x, prepared.y, prepared.animationTime, prepared.runtime);
        break;
      case 'herbivore':
        this.drawHerbivoreEntity(ctx, prepared.entity, prepared.x, prepared.y, prepared.animationTime, prepared.motionSpeed);
        break;
      case 'carnivore':
        this.drawCarnivoreEntity(ctx, prepared.entity, prepared.x, prepared.y, prepared.animationTime, prepared.behavior);
        break;
      case 'fungus':
        this.drawFungusEntity(ctx, prepared.entity, prepared.x, prepared.y, prepared.animationTime, prepared.behavior);
        break;
    }

    ctx.restore();
  }

  private drawDeadEntityCarcass(
    ctx: CanvasRenderingContext2D,
    prepared: PreparedEntity,
  ): void {
    const remainingEnergyFactor = Math.max(0, Math.min(1, prepared.entity.energy / 100));
    const decayFactor = 1 - remainingEnergyFactor;
    const carcassScale = 0.25 + (remainingEnergyFactor * 0.75);
    const carcassRadius = Math.max(1.5, prepared.radius * carcassScale);
    const darkness = 16 + Math.round(decayFactor * 56);
    const alpha = 0.24 + (remainingEnergyFactor * 0.2);
    const flattenY = 0.55 - (decayFactor * 0.2);

    ctx.save();
    ctx.fillStyle = `rgba(${darkness}, ${darkness}, ${darkness}, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(
      prepared.x,
      prepared.y,
      carcassRadius,
      carcassRadius * flattenY,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Keep a faint rim while the carcass still has decomposable mass.
    if (remainingEnergyFactor > 0.05) {
      const rimAlpha = 0.08 + (remainingEnergyFactor * 0.12);
      ctx.strokeStyle = `rgba(${darkness + 20}, ${darkness + 16}, ${darkness + 12}, ${rimAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(
        prepared.x,
        prepared.y,
        carcassRadius,
        carcassRadius * flattenY,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  private applyTypeMotionTransform(
    ctx: CanvasRenderingContext2D,
    prepared: PreparedEntity,
    config: EntityRenderConfig,
  ): void {
    const basePulse = Math.sin(prepared.animationTime * 2.2) * 0.02;

    switch (prepared.entity.type) {
      case 'plant': {
        const entity = toPlantVisualEntity(prepared.entity, prepared.x, prepared.y);
        const visual = getPlantVisual(entity);
        const tremor = prepared.entity.health < 35 ? Math.sin(prepared.animationTime * 24) * 0.8 : 0;
        const sway = Math.sin(prepared.animationTime * (0.8 + visual.genome.plant.silhouetteNoise)) * (1.3 + visual.genome.plant.branchDepth * 0.2);
        ctx.translate(sway + tremor, 0);
        break;
      }
      case 'herbivore': {
        const entity = toHerbivoreVisualEntity(prepared.entity, prepared.x, prepared.y);
        const visual = getHerbivoreVisual(entity);
        const gait = visual.genome.herbivore.gaitProfile;
        const bob = Math.sin(prepared.animationTime * 10 * gait) * (0.7 + prepared.motionSpeed * 0.02);
        ctx.translate(0, -bob);
        ctx.scale(1 + basePulse * 0.4, 1 - basePulse * 0.3);
        break;
      }
      case 'carnivore': {
        const entity = toCarnivoreVisualEntity(prepared.entity, prepared.x, prepared.y);
        const visual = getCarnivoreVisual(entity);
        const crouch = prepared.behavior === 'hunt' ? 1 - visual.genome.carnivore.stanceProfile * 0.02 : 1;
        const shoulderRoll = Math.sin(prepared.animationTime * (4 + visual.genome.carnivore.tailDynamics * 0.5)) * 0.008;
        ctx.translate(0, prepared.behavior === 'hunt' ? 0.8 : 0);
        ctx.scale(1, crouch);
        ctx.rotate(shoulderRoll);
        break;
      }
      case 'fungus': {
        // Fungi stay rooted in place; no transform animation.
        break;
      }
    }

    if (config.qualityTier === 'low') {
      ctx.globalAlpha = 0.96;
    }
  }

  private drawPlantEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'plant' }>,
    x: number,
    y: number,
    time: number,
    runtime: RuntimeVisualState,
  ): void {
    const plantVisualEntity = toPlantVisualEntity(entity, x, y);
    const visual = getPlantVisual(plantVisualEntity);

    const growthPulse = 1 + runtime.sunlightOverlay * 0.03;
    ctx.save();
    ctx.scale(growthPulse, growthPulse);
    this.plantRenderer.render(ctx, entity, visual, x / growthPulse, y / growthPulse, time);
    ctx.restore();
  }

  private drawHerbivoreEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'herbivore' }>,
    x: number,
    y: number,
    time: number,
    motionSpeed: number,
  ): void {
    const herbivoreVisualEntity = toHerbivoreVisualEntity(entity, x, y);
    const visual = getHerbivoreVisual(herbivoreVisualEntity);
    const gaitTime = time * (1 + visual.genome.herbivore.gaitProfile * 0.12 + Math.min(0.35, motionSpeed * 0.01));
    this.herbivoreRenderer.render(ctx, entity, visual, x, y, gaitTime);
  }

  private drawFungusEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'fungus' }>,
    x: number,
    y: number,
    time: number,
    behavior: BehaviorState,
  ): void {
    const fungusVisualEntity = toFungusVisualEntity(entity, x, y);
    const visual = getFungusVisual(fungusVisualEntity);
    const ventCadenceBoost = behavior === 'forage' ? 1.2 : 1;
    this.fungusRenderer.render(ctx, entity, visual, x, y, time * ventCadenceBoost);
  }

  private drawCarnivoreEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'carnivore' }>,
    x: number,
    y: number,
    time: number,
    behavior: BehaviorState,
  ): void {
    const carnivoreVisualEntity = toCarnivoreVisualEntity(entity, x, y);
    const visual = getCarnivoreVisual(carnivoreVisualEntity);
    const huntingTime = behavior === 'hunt' ? time * 1.2 : time;
    this.carnivoreRenderer.render(ctx, entity, visual, x, y, huntingTime);
  }

  private drawStateOverlay(
    ctx: CanvasRenderingContext2D,
    prepared: PreparedEntity,
    config: EntityRenderConfig,
  ): void {
    if (config.qualityTier === 'low' && prepared.runtime.energyOverlay < 0.85) {
      return;
    }

    const vitalityOverlay = (prepared.runtime.energyOverlay * 0.65) + (prepared.runtime.healthOverlay * 0.35);
    const overlayRadius = prepared.radius * (1 + prepared.runtime.sunlightOverlay * 0.05);
    const alpha = 0.006 + vitalityOverlay * 0.022;
    const hue = prepared.entity.type === 'fungus'
      ? 185
      : prepared.entity.type === 'carnivore'
        ? 12
        : prepared.entity.type === 'herbivore'
          ? 46
          : 132;

    const gradient = ctx.createRadialGradient(prepared.x, prepared.y, prepared.radius * 0.2, prepared.x, prepared.y, overlayRadius);
    gradient.addColorStop(0, `hsla(${hue}, 85%, 60%, ${alpha})`);
    gradient.addColorStop(1, `hsla(${hue}, 85%, 60%, 0)`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(prepared.x, prepared.y, overlayRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private calculateEntityPhaseOffset(entityId: string): number {
    let hash = 0;
    for (let index = 0; index < entityId.length; index += 1) {
      hash = ((hash << 5) - hash) + entityId.charCodeAt(index);
      hash |= 0;
    }
    return (Math.abs(hash) % 628) / 100;
  }

  private drawNameTag(
    ctx: CanvasRenderingContext2D,
    name: string,
    x: number,
    y: number,
    isSelected: boolean,
  ): void {
    ctx.font = isSelected ? 'bold 12px sans-serif' : '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(name).width;
    const padding = 6;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 16;
    const boxX = x - boxWidth / 2;
    const boxY = y - boxHeight / 2;

    ctx.fillStyle = isSelected ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
    ctx.fill();

    ctx.fillStyle = isSelected ? '#fff' : 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(name, x, y);
  }
}

function drawSelectionRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(x, y, radius + 12, 0, Math.PI * 2);
  ctx.stroke();
}

function buildRuntimeVisualState(entity: Entity, config: EntityRenderConfig): RuntimeVisualState {
  const healthOverlay = Math.max(0, Math.min(1, entity.health / 100));
  const energyOverlay = Math.max(0, Math.min(1, entity.energy / 100));
  const sunlightOverlay = Math.max(0, Math.min(1, config.lighting.sunlight));
  const lifecycleOverlay = Math.max(0, Math.min(1, entity.age / 100));

  return {
    healthOverlay,
    energyOverlay,
    sunlightOverlay,
    lifecycleOverlay,
  };
}

function toPlantVisualEntity(
  entity: Extract<Entity, { type: 'plant' }>,
  x: number,
  y: number,
): PlantVisualEntity {
  return {
    id: entity.id,
    name: entity.name,
    species: entity.species,
    health: entity.health,
    energy: entity.energy,
    position: { x, y },
    traits: {
      photosynthesisRate: entity.photosynthesisRate,
      reproductionRate: entity.reproductionRate,
      metabolismEfficiency: entity.metabolismEfficiency,
    },
  };
}

function toHerbivoreVisualEntity(
  entity: Extract<Entity, { type: 'herbivore' }>,
  x: number,
  y: number,
): HerbivoreVisualEntity {
  return {
    id: entity.id,
    name: entity.name,
    species: entity.species,
    health: entity.health,
    energy: entity.energy,
    position: { x, y },
    traits: {
      reproductionRate: entity.reproductionRate,
      movementSpeed: entity.movementSpeed,
      metabolismEfficiency: entity.metabolismEfficiency,
      perceptionRadius: entity.perceptionRadius,
    },
  };
}

function toFungusVisualEntity(
  entity: Extract<Entity, { type: 'fungus' }>,
  x: number,
  y: number,
): FungusVisualEntity {
  return {
    id: entity.id,
    name: entity.name,
    species: entity.species,
    health: entity.health,
    energy: entity.energy,
    position: { x, y },
    traits: {
      reproductionRate: entity.reproductionRate,
      metabolismEfficiency: entity.metabolismEfficiency,
      decompositionRate: entity.decompositionRate,
      perceptionRadius: entity.perceptionRadius,
    },
  };
}

function toCarnivoreVisualEntity(
  entity: Extract<Entity, { type: 'carnivore' }>,
  x: number,
  y: number,
): CarnivoreVisualEntity {
  return {
    id: entity.id,
    name: entity.name,
    species: entity.species,
    health: entity.health,
    energy: entity.energy,
    position: { x, y },
    traits: {
      reproductionRate: entity.reproductionRate,
      movementSpeed: entity.movementSpeed,
      metabolismEfficiency: entity.metabolismEfficiency,
      perceptionRadius: entity.perceptionRadius,
    },
  };
}
