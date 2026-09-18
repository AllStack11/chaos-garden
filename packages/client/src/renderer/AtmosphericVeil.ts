/**
 * Chaos Garden - Fullscreen Atmospheric Veil (Layer 4)
 *
 * Fullscreen atmospheric overlay applying diurnal color grading (Dawn, Day, Dusk, Night)
 * and terrarium perimeter boundary guidance.
 */

import { Container, Graphics } from 'pixi.js';

export class AtmosphericVeil extends Container {
  private tintGraphic: Graphics;
  private boundaryGraphic: Graphics;
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number = 1600, worldHeight: number = 1200) {
    super();
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.tintGraphic = new Graphics();
    this.boundaryGraphic = new Graphics();

    this.addChild(this.tintGraphic);
    this.addChild(this.boundaryGraphic);

    this.drawBoundary();
    this.updateAtmosphere(0.8, 0.0);
  }

  private drawBoundary(): void {
    const g = this.boundaryGraphic;
    g.clear();
    // Glowing terrarium boundary
    g.rect(0, 0, this.worldWidth, this.worldHeight);
    g.stroke({ width: 2, color: 0x10b981, alpha: 0.3 });
  }

  /**
   * Updates diurnal lighting overlay based on sunlight (0.0 = night, 1.0 = noon) and rain.
   */
  updateAtmosphere(sunlight: number, rain: number): void {
    const g = this.tintGraphic;
    g.clear();

    const w = this.worldWidth;
    const h = this.worldHeight;

    // When sunlight < 0.6, darken scene with navy night tint
    if (sunlight < 0.8) {
      const darkness = (0.8 - sunlight) / 0.8;
      // Night blue/navy
      g.rect(0, 0, w, h);
      g.fill({ color: 0x050b18, alpha: darkness * 0.55 });
    }

    // Weather dimming / storm tint
    if (rain > 0.05) {
      g.rect(0, 0, w, h);
      g.fill({ color: 0x0f172a, alpha: rain * 0.25 });
    }
  }
}

