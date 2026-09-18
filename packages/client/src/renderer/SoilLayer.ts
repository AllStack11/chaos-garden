/**
 * Chaos Garden - Living Soil Layer (Layer 1)
 *
 * Uploads 2-channel soil scalar fields (moisture & nitrates) to a dynamic GPU texture.
 * Hardware bilinear filtering renders smooth organic contours across the 1600x1200 garden in 1 draw call.
 */

import { Container, Sprite, Texture, BufferImageSource } from 'pixi.js';

export interface SoilLayerOptions {
  cols?: number;
  rows?: number;
  worldWidth?: number;
  worldHeight?: number;
}

export class SoilLayer extends Container {
  readonly cols: number;
  readonly rows: number;
  readonly worldWidth: number;
  readonly worldHeight: number;

  private bufferSource: BufferImageSource;
  private soilSprite: Sprite;
  private rgbaPixels: Uint8Array;

  constructor(options: SoilLayerOptions = {}) {
    super();

    this.cols = options.cols ?? 100;
    this.rows = options.rows ?? 75;
    this.worldWidth = options.worldWidth ?? 1600;
    this.worldHeight = options.worldHeight ?? 1200;

    const totalPixels = this.cols * this.rows;
    this.rgbaPixels = new Uint8Array(totalPixels * 4);

    // Initialize baseline soil color
    for (let i = 0; i < totalPixels; i++) {
      const base = i * 4;
      this.rgbaPixels[base] = 128;     // 50% baseline moisture
      this.rgbaPixels[base + 1] = 76;  // 30% baseline nitrates
      this.rgbaPixels[base + 2] = 40;  // soil mineral base
      this.rgbaPixels[base + 3] = 255; // Opaque
    }

    this.bufferSource = new BufferImageSource({
      resource: this.rgbaPixels,
      width: this.cols,
      height: this.rows,
      format: 'rgba8unorm',
      scaleMode: 'linear',
    });

    const texture = new Texture({ source: this.bufferSource });
    this.soilSprite = new Sprite(texture);
    this.soilSprite.width = this.worldWidth;
    this.soilSprite.height = this.worldHeight;

    this.addChild(this.soilSprite);
  }

  /**
   * Updates dynamic GPU texture from transferred worker Float32Array buffers.
   */
  updateBuffers(moistureBuffer: ArrayBuffer, nitrateBuffer: ArrayBuffer): void {
    const moisture = new Float32Array(moistureBuffer);
    const nitrates = new Float32Array(nitrateBuffer);
    const count = Math.min(moisture.length, this.cols * this.rows);
    const pixels = this.rgbaPixels;

    for (let i = 0; i < count; i++) {
      const base = i * 4;
      const m = moisture[i];
      const n = nitrates[i];

      // Moisture maps to deep forest greens (R: earthy loam, G: rich flora moisture)
      pixels[base] = Math.min(255, Math.max(0, Math.floor(m * 220 + 20)));
      pixels[base + 1] = Math.min(255, Math.max(0, Math.floor(n * 255)));
      pixels[base + 2] = Math.min(255, Math.max(0, Math.floor(m * 60 + n * 120)));
      pixels[base + 3] = 255;
    }

    this.bufferSource.update();
  }
}

