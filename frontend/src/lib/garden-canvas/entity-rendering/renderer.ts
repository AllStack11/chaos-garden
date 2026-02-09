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

export class GardenEntityRenderer {
  private readonly plantRenderer = new PlantRenderer();
  private readonly herbivoreRenderer = new HerbivoreRenderer();
  private readonly fungusRenderer = new FungusRenderer();
  private readonly carnivoreRenderer = new CarnivoreRenderer();

  renderEntities(
    ctx: CanvasRenderingContext2D,
    entities: Entity[],
    config: EntityRenderConfig,
  ): void {
    const sortedEntities = [...entities].sort((left, right) => left.position.y - right.position.y);
    const time = Date.now() / 1000;

    sortedEntities.forEach((entity) => {
      this.drawEntity(ctx, entity, time, config);
    });
  }

  private drawEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    time: number,
    config: EntityRenderConfig,
  ): void {
    if (!entity.isAlive) return;

    const isSelected = config.selectedEntity?.id === entity.id;
    const isHovered = config.hoveredEntity?.id === entity.id;
    const { x, y, scale } = config.worldToScreen(entity.position.x, entity.position.y);
    const radius = config.calculateEntitySize(entity.energy) * scale;

    this.drawDetailedEntity(ctx, entity, x, y, time);

    if (isHovered) {
      this.drawNameTag(ctx, entity.name, x, y - radius - 15, false);
    }

    if (isSelected) {
      drawSelectionRing(ctx, x, y, radius);
    }
  }

  private calculateEntityTimeOffset(entityId: string): number {
    let hash = 0;
    for (let i = 0; i < entityId.length; i++) {
      hash = ((hash << 5) - hash) + entityId.charCodeAt(i);
      hash = hash & hash;
    }
    return (Math.abs(hash) % 628) / 100;
  }

  private drawDetailedEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    x: number,
    y: number,
    time: number,
  ): void {
    const entityTime = time + this.calculateEntityTimeOffset(entity.id);

    switch (entity.type) {
      case 'plant':
        this.drawPlantEntity(ctx, entity, x, y, entityTime);
        break;
      case 'herbivore':
        this.drawHerbivoreEntity(ctx, entity, x, y, entityTime);
        break;
      case 'carnivore':
        this.drawCarnivoreEntity(ctx, entity, x, y, entityTime);
        break;
      case 'fungus':
        this.drawFungusEntity(ctx, entity, x, y, entityTime);
        break;
    }
  }

  private drawPlantEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'plant' }>,
    x: number,
    y: number,
    time: number,
  ): void {
    const plantVisualEntity = toPlantVisualEntity(entity, x, y);
    const visual = getPlantVisual(plantVisualEntity);
    this.plantRenderer.render(ctx, entity, visual, x, y, time);
  }

  private drawHerbivoreEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'herbivore' }>,
    x: number,
    y: number,
    time: number,
  ): void {
    const herbivoreVisualEntity = toHerbivoreVisualEntity(entity, x, y);
    const visual = getHerbivoreVisual(herbivoreVisualEntity);
    this.herbivoreRenderer.render(ctx, entity, visual, x, y, time);
  }

  private drawFungusEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'fungus' }>,
    x: number,
    y: number,
    time: number,
  ): void {
    const fungusVisualEntity = toFungusVisualEntity(entity, x, y);
    const visual = getFungusVisual(fungusVisualEntity);
    this.fungusRenderer.render(ctx, entity, visual, x, y, time);
  }

  private drawCarnivoreEntity(
    ctx: CanvasRenderingContext2D,
    entity: Extract<Entity, { type: 'carnivore' }>,
    x: number,
    y: number,
    time: number,
  ): void {
    const carnivoreVisualEntity = toCarnivoreVisualEntity(entity, x, y);
    const visual = getCarnivoreVisual(carnivoreVisualEntity);
    this.carnivoreRenderer.render(ctx, entity, visual, x, y, time);
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
