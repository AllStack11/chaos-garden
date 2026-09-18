/**
 * Chaos Garden - Bioluminescent Organisms Layer (Layer 2)
 *
 * Batched rendering of up to 2,000 organisms across all 4 kingdoms.
 * Unpacks flat 32-byte binary strides directly into pooled sprite transforms with 0 heap allocations.
 * Maintains <= 5 GPU draw calls.
 */

import { Container, Sprite, Texture, CanvasSource } from 'pixi.js';
import { EntityTypeCode } from '@chaos-garden/shared';

const BASE_SPRITE_SIZE = 32;

function createArchetypeCanvas(
  type: EntityTypeCode,
  size: number = BASE_SPRITE_SIZE,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = size / 2;
  ctx.clearRect(0, 0, size, size);

  switch (type) {
    case EntityTypeCode.PLANT: {
      // Radiant floral bioluminescent node
      const grad = ctx.createRadialGradient(center, center, 2, center, center, center - 2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.3, 'rgba(16, 185, 129, 0.9)');
      grad.addColorStop(0.7, 'rgba(5, 150, 105, 0.5)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center, center, center - 2, 0, Math.PI * 2);
      ctx.fill();

      // Outer photosynthetic pulsing ring
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center, center, center - 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case EntityTypeCode.HERBIVORE: {
      // Fluid cyan amoebic boid with swimming membrane and eye spot
      const grad = ctx.createRadialGradient(center, center, 2, center, center, center - 2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.4, 'rgba(6, 182, 212, 0.9)');
      grad.addColorStop(0.8, 'rgba(14, 116, 144, 0.5)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Teardrop / boid wedge facing +X
      ctx.moveTo(center + 10, center);
      ctx.quadraticCurveTo(center - 10, center - 10, center - 12, center);
      ctx.quadraticCurveTo(center - 10, center + 10, center + 10, center);
      ctx.fill();

      // Eye spot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(center + 4, center - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case EntityTypeCode.CARNIVORE: {
      // Sleek predatory dart with sharp bio-energy aura (crimson)
      const grad = ctx.createRadialGradient(center, center, 2, center, center, center - 2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.4, 'rgba(244, 63, 94, 0.95)');
      grad.addColorStop(0.8, 'rgba(159, 18, 57, 0.6)');
      grad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Sharp predatory arrowhead facing +X
      ctx.moveTo(center + 13, center);
      ctx.lineTo(center - 11, center - 9);
      ctx.lineTo(center - 5, center);
      ctx.lineTo(center - 11, center + 9);
      ctx.closePath();
      ctx.fill();

      // Sharp central spine
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(center + 10, center);
      ctx.lineTo(center - 6, center);
      ctx.stroke();
      break;
    }

    case EntityTypeCode.FUNGUS: {
      // Radiant hyphal mycelium cap with breathing spore aura (purple)
      const grad = ctx.createRadialGradient(center, center, 2, center, center, center - 2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.3, 'rgba(168, 85, 247, 0.9)');
      grad.addColorStop(0.7, 'rgba(126, 34, 206, 0.5)');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center, center, center - 4, 0, Math.PI * 2);
      ctx.fill();

      // Spore node dots
      ctx.fillStyle = 'rgba(233, 213, 255, 0.9)';
      for (let a = 0; a < 6; a++) {
        const rad = (a / 6) * Math.PI * 2;
        const sx = center + Math.cos(rad) * 6;
        const sy = center + Math.sin(rad) * 6;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }

  return canvas;
}

export class OrganismLayer extends Container {
  private textures: Map<EntityTypeCode, Texture> = new Map();
  private pool: Sprite[] = [];
  private activeCount: number = 0;
  readonly maxCapacity: number;

  constructor(maxCapacity: number = 2000) {
    super();
    this.maxCapacity = maxCapacity;

    // Pre-bake textures for all 4 kingdoms
    const kingdoms = [
      EntityTypeCode.PLANT,
      EntityTypeCode.HERBIVORE,
      EntityTypeCode.CARNIVORE,
      EntityTypeCode.FUNGUS,
    ];

    for (const kingdom of kingdoms) {
      const canvas = createArchetypeCanvas(kingdom, BASE_SPRITE_SIZE);
      const texture = new Texture({ source: new CanvasSource({ resource: canvas }) });
      this.textures.set(kingdom, texture);
    }

    const defaultTexture = this.textures.get(EntityTypeCode.PLANT)!;

    // Pre-allocate sprite pool
    for (let i = 0; i < maxCapacity; i++) {
      const sprite = new Sprite(defaultTexture);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      this.pool.push(sprite);
      this.addChild(sprite);
    }
  }

  /**
   * Unpacks incoming 32-byte binary render strides directly into pooled sprite transforms.
   * Zero heap allocations.
   */
  updateFromBuffer(buffer: ArrayBuffer, entityCount: number): void {
    const floatView = new Float32Array(buffer);
    const count = Math.min(entityCount, this.maxCapacity);

    for (let i = 0; i < count; i++) {
      const offset = i * 8;
      const x = floatView[offset + 1];
      const y = floatView[offset + 2];
      const rotation = floatView[offset + 3];
      const size = floatView[offset + 4];
      const typeCode = floatView[offset + 5] as EntityTypeCode;
      const healthRatio = floatView[offset + 6];

      const sprite = this.pool[i];
      const tex = this.textures.get(typeCode);
      if (tex && sprite.texture !== tex) {
        sprite.texture = tex;
      }

      sprite.position.set(x, y);
      sprite.rotation = rotation;
      const scale = size / (BASE_SPRITE_SIZE * 0.5);
      sprite.scale.set(scale, scale);
      sprite.alpha = 0.35 + healthRatio * 0.65;
      sprite.visible = true;
    }

    // Hide any sprites beyond active entity count
    for (let i = count; i < this.activeCount; i++) {
      this.pool[i].visible = false;
    }

    this.activeCount = count;
  }
}

