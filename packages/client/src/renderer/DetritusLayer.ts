/**
 * Chaos Garden - Detritus & Spores Layer (Layer 3)
 *
 * Renders drifting fungal spores and decomposing detritus particles on the soil bed in 1 draw call.
 */

import { Container, Sprite, Texture, CanvasSource } from 'pixi.js';

const SPORE_COUNT = 80;

function createSporeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(8, 8, 1, 8, 8, 7);
    grad.addColorStop(0, 'rgba(216, 180, 254, 0.9)');
    grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.5)');
    grad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export class DetritusLayer extends Container {
  private spores: Sprite[] = [];
  private velocitiesX: Float32Array;
  private velocitiesY: Float32Array;
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number = 1600, worldHeight: number = 1200) {
    super();
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    const texture = new Texture({
      source: new CanvasSource({ resource: createSporeCanvas() }),
    });

    this.velocitiesX = new Float32Array(SPORE_COUNT);
    this.velocitiesY = new Float32Array(SPORE_COUNT);

    for (let i = 0; i < SPORE_COUNT; i++) {
      const spore = new Sprite(texture);
      spore.anchor.set(0.5, 0.5);
      spore.x = Math.random() * worldWidth;
      spore.y = Math.random() * worldHeight;
      spore.scale.set(0.4 + Math.random() * 0.6);
      spore.alpha = 0.2 + Math.random() * 0.4;

      this.velocitiesX[i] = (Math.random() - 0.5) * 0.6;
      this.velocitiesY[i] = (Math.random() - 0.5) * 0.6;

      this.spores.push(spore);
      this.addChild(spore);
    }
  }

  /**
   * Advances drifting spore particles each frame with toroidal wrapping.
   */
  update(): void {
    const w = this.worldWidth;
    const h = this.worldHeight;

    for (let i = 0; i < SPORE_COUNT; i++) {
      const s = this.spores[i];
      s.x += this.velocitiesX[i];
      s.y += this.velocitiesY[i];

      // Toroidal wrapping
      if (s.x < 0) s.x += w;
      else if (s.x >= w) s.x -= w;
      if (s.y < 0) s.y += h;
      else if (s.y >= h) s.y -= h;
    }
  }
}

