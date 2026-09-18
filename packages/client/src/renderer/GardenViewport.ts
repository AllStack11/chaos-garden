/**
 * Chaos Garden - Garden Viewport & PixiJS v8 Hardware-Accelerated Pipeline
 *
 * Manages PixiJS Application, DPR scaling, 4-layer composition (< 10 draw calls),
 * and the continuous 60 FPS animation ticker consuming zero-copy transferable buffers.
 */

import { Application, Container } from 'pixi.js';
import { SoilLayer } from './SoilLayer.js';
import { DetritusLayer } from './DetritusLayer.js';
import { OrganismLayer } from './OrganismLayer.js';
import { AtmosphericVeil } from './AtmosphericVeil.js';
import { CameraController } from './CameraController.js';

export interface GardenViewportOptions {
  canvas: HTMLCanvasElement;
  worldWidth?: number;
  worldHeight?: number;
}

export class GardenViewport {
  readonly app: Application;
  readonly worldWidth: number;
  readonly worldHeight: number;

  readonly worldContainer: Container;
  readonly soilLayer: SoilLayer;
  readonly detritusLayer: DetritusLayer;
  readonly organismLayer: OrganismLayer;
  readonly atmosphericVeil: AtmosphericVeil;
  readonly camera: CameraController;

  private isInitialized = false;

  constructor(options: GardenViewportOptions) {
    this.worldWidth = options.worldWidth ?? 1600;
    this.worldHeight = options.worldHeight ?? 1200;

    this.app = new Application();
    this.worldContainer = new Container();

    this.soilLayer = new SoilLayer({
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
    });
    this.detritusLayer = new DetritusLayer(this.worldWidth, this.worldHeight);
    this.organismLayer = new OrganismLayer(2000);
    this.atmosphericVeil = new AtmosphericVeil(this.worldWidth, this.worldHeight);

    this.worldContainer.addChild(this.soilLayer);
    this.worldContainer.addChild(this.detritusLayer);
    this.worldContainer.addChild(this.organismLayer);
    this.worldContainer.addChild(this.atmosphericVeil);

    this.app.stage.addChild(this.worldContainer);
    this.camera = new CameraController(this.worldContainer, {
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
    });
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    await this.app.init({
      canvas,
      width,
      height,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl',
      backgroundColor: 0x0a0d14,
      antialias: true,
    });

    this.camera.resize(width, height);
    this.camera.centerOn(this.worldWidth / 2, this.worldHeight / 2);

    // Continuous ticker for camera inertia and detritus drift
    this.app.ticker.add(() => {
      this.camera.update();
      this.detritusLayer.update();
    });

    this.isInitialized = true;
  }

  renderFrame(buffer: ArrayBuffer, entityCount: number): void {
    if (!this.isInitialized) return;
    this.organismLayer.updateFromBuffer(buffer, entityCount);
  }

  updateSoil(moistureBuffer: ArrayBuffer, nitrateBuffer: ArrayBuffer): void {
    if (!this.isInitialized) return;
    this.soilLayer.updateBuffers(moistureBuffer, nitrateBuffer);
  }

  updateAtmosphere(sunlight: number, rain: number): void {
    if (!this.isInitialized) return;
    this.atmosphericVeil.updateAtmosphere(sunlight, rain);
  }

  resize(width: number, height: number): void {
    if (!this.isInitialized) return;
    this.app.renderer.resize(width, height);
    this.camera.resize(width, height);
  }

  stopTicker(): void {
    if (this.app.ticker.started) {
      this.app.ticker.stop();
    }
  }

  startTicker(): void {
    if (!this.app.ticker.started) {
      this.app.ticker.start();
    }
  }

  destroy(): void {
    if (this.isInitialized) {
      this.app.destroy(true, { children: true, texture: true });
      this.isInitialized = false;
    }
  }
}

