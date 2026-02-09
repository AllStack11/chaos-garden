import type { Entity } from '../../../env.d.ts';
import { PlantRenderer } from '../../rendering/entities/PlantRenderer.ts';
import { HerbivoreRenderer } from '../../rendering/entities/HerbivoreRenderer.ts';
import { getPlantVisual } from '../../rendering/PlantVisualSystem.ts';
import { getHerbivoreVisual } from '../../rendering/HerbivoreVisualSystem.ts';
import type { EntityColor, EntityRenderConfig } from './types.ts';

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

export class GardenEntityRenderer {
  private readonly plantRenderer = new PlantRenderer();
  private readonly herbivoreRenderer = new HerbivoreRenderer();

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
    const color = config.colors[entity.type] ?? config.colors.plant;

    this.drawDetailedEntity(ctx, entity, x, y, scale, radius, color, time);

    if (isHovered) {
      this.drawNameTag(ctx, entity.name, x, y - radius - 15, false);
    }

    if (isSelected) {
      drawSelectionRing(ctx, x, y, radius);
    }
  }

  private drawDetailedEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    x: number,
    y: number,
    scale: number,
    radius: number,
    color: EntityColor,
    time: number,
  ): void {
    const healthFactor = entity.health / 100;
    const energyFactor = entity.energy / 100;
    const baseColor = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    const healthColor = `hsl(${color.h}, ${color.s * healthFactor}%, ${color.l + (1 - healthFactor) * 20}%)`;

    switch (entity.type) {
      case 'plant':
        this.drawPlantEntity(ctx, entity, x, y, time);
        break;
      case 'herbivore':
        this.drawHerbivoreEntity(ctx, entity, x, y, time);
        break;
      case 'carnivore':
        drawCarnivoreEntity(ctx, x, y, scale, radius, healthColor, time, energyFactor);
        break;
      case 'fungus':
        drawFungusEntity(ctx, x, y, radius, baseColor, time, energyFactor);
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

function drawCarnivoreEntity(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  radius: number,
  healthColor: string,
  time: number,
  energyFactor: number,
): void {
  const isHunting = energyFactor < 0.5;
  const bob = Math.abs(Math.sin(time * 6)) * 2;
  const tailSway = Math.sin(time * 4) * 0.15;

  ctx.strokeStyle = healthColor;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - radius, y - bob);
  ctx.quadraticCurveTo(
    x - radius * 1.5,
    y - bob + tailSway * 15,
    x - radius * 2,
    y - bob + tailSway * 5,
  );
  ctx.stroke();

  ctx.fillStyle = healthColor;
  ctx.beginPath();
  ctx.ellipse(x, y - bob, radius * 1.3, radius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x + radius * 0.8, y - bob - radius * 0.3, radius * 0.5, radius * 0.4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  const eyeColor = isHunting ? '#ff4444' : '#333';
  ctx.fillStyle = isHunting ? '#ffcccc' : 'white';
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.9, y - bob - radius * 0.35, radius * 0.15, radius * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(x + radius * 0.92, y - bob - radius * 0.35, radius * 0.07, 0, Math.PI * 2);
  ctx.fill();

  if (isHunting) {
    const glow = ctx.createRadialGradient(x + radius, y - bob, 0, x + radius, y - bob, radius * 3);
    glow.addColorStop(0, 'rgba(255, 100, 100, 0.2)');
    glow.addColorStop(1, 'transparent');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + radius, y - bob, radius * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFungusEntity(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  baseColor: string,
  time: number,
  energyFactor: number,
): void {
  const capY = y - radius * 1.2;
  const capWidth = radius * 2;

  ctx.fillStyle = '#f5f5f5';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.2, y);
  ctx.quadraticCurveTo(x - radius * 0.1, y - radius * 0.6, x, y - radius);
  ctx.quadraticCurveTo(x + radius * 0.1, y - radius * 0.6, x + radius * 0.2, y);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(x, capY, capWidth * 0.5, Math.PI, 0);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;
  for (let index = -2; index <= 2; index += 1) {
    ctx.beginPath();
    ctx.moveTo(x + index * radius * 0.15, capY + 2);
    ctx.lineTo(x + index * radius * 0.15, capY + radius * 0.3);
    ctx.stroke();
  }

  const isNight = Math.sin(time * 0.5) > 0;
  if (isNight || energyFactor > 0.6) {
    const glowIntensity = isNight ? 0.3 + Math.sin(time * 3) * 0.2 : (energyFactor - 0.6) * 0.5;
    const glow = ctx.createRadialGradient(x, capY, 0, x, capY, capWidth);
    glow.addColorStop(0, `hsla(280, 70%, 70%, ${glowIntensity})`);
    glow.addColorStop(1, 'transparent');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, capY, capWidth, 0, Math.PI * 2);
    ctx.fill();
  }
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
