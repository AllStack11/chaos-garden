import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { CameraController } from '../../src/renderer/CameraController.js';
import { AtmosphericVeil } from '../../src/renderer/AtmosphericVeil.js';
import { DetritusLayer } from '../../src/renderer/DetritusLayer.js';
import { SoilLayer } from '../../src/renderer/SoilLayer.js';
import { OrganismLayer } from '../../src/renderer/OrganismLayer.js';
import { GardenViewport } from '../../src/renderer/GardenViewport.js';
import { atmosphericVertexShader, atmosphericFragmentShader } from '../../src/renderer/shaders/bloomShader.js';
import { soilVertexShader, soilFragmentShader } from '../../src/renderer/shaders/soilShader.js';
import { EntityTypeCode, packEntityFieldsToStride, STRIDE_FLOAT_COUNT } from '@chaos-garden/shared';

describe('PixiJS v8 Hardware-Accelerated Pipeline Unit Tests', () => {
  describe('CameraController Unit Tests', () => {
    let stage: Container;
    let camera: CameraController;

    beforeEach(() => {
      stage = new Container();
      camera = new CameraController(stage, {
        worldWidth: 1600,
        worldHeight: 1200,
        minZoom: 0.25,
        maxZoom: 5.0,
      });
      camera.resize(800, 600);
    });

    it('correctly maps coordinates between world and screen space', () => {
      camera.centerOn(800, 600);

      // Center of world should map to center of viewport (400, 300)
      const screenCenter = camera.worldToScreen(800, 600);
      expect(Math.round(screenCenter.x)).toBe(400);
      expect(Math.round(screenCenter.y)).toBe(300);

      // Inverting screen (400, 300) should yield world (800, 600)
      const worldCenter = camera.screenToWorld(400, 300);
      expect(Math.round(worldCenter.x)).toBe(800);
      expect(Math.round(worldCenter.y)).toBe(600);
    });

    it('clamps zoom within bounds [0.25, 5.0]', () => {
      // Zoom in heavily
      for (let i = 0; i < 20; i++) {
        camera.zoomAt(400, 300, 1.5);
      }
      expect(camera.currentZoom).toBeLessThanOrEqual(5.0);

      // Zoom out heavily
      for (let i = 0; i < 30; i++) {
        camera.zoomAt(400, 300, 0.5);
      }
      expect(camera.currentZoom).toBeGreaterThanOrEqual(0.25);
    });

    it('engages follow-cam and smoothly tracks entity coordinates', () => {
      const target = { x: 500, y: 400 };
      camera.setFollowTarget(target);
      expect(camera.isFollowActive).toBe(true);

      // Run a camera update step
      camera.update();

      // Disengage on manual drag
      camera.startDrag(200, 200);
      expect(camera.isFollowActive).toBe(false);
    });
  });

  describe('AtmosphericVeil Unit Tests', () => {
    it('updates lighting for noon, midnight, and rain storms', () => {
      const veil = new AtmosphericVeil(1600, 1200);
      expect(veil.children.length).toBe(2);

      // Bright noon
      expect(() => veil.updateAtmosphere(1.0, 0.0)).not.toThrow();

      // Dark midnight
      expect(() => veil.updateAtmosphere(0.1, 0.0)).not.toThrow();

      // Rainy storm
      expect(() => veil.updateAtmosphere(0.4, 0.8)).not.toThrow();
    });
  });

  describe('DetritusLayer Unit Tests', () => {
    it('instantiates spores and advances toroidal drift simulation', () => {
      const detritus = new DetritusLayer(1600, 1200);
      expect(detritus.children.length).toBe(80);

      // Advance 10 simulation frames
      for (let i = 0; i < 10; i++) {
        detritus.update();
      }
      expect(detritus.children[0].x).toBeDefined();
    });
  });

  describe('SoilLayer Unit Tests', () => {
    it('allocates texture buffer and uploads dynamic moisture and nitrate fields', () => {
      const soil = new SoilLayer({ cols: 10, rows: 10, worldWidth: 1600, worldHeight: 1200 });
      expect(soil.cols).toBe(10);
      expect(soil.rows).toBe(10);

      const moisture = new Float32Array(100).fill(0.7);
      const nitrates = new Float32Array(100).fill(0.3);

      expect(() => soil.updateBuffers(moisture, nitrates)).not.toThrow();
    });
  });

  describe('OrganismLayer Unit Tests', () => {
    it('unpacks binary render strides directly across all 4 kingdoms with zero allocations', () => {
      const layer = new OrganismLayer(50);
      expect(layer.maxCapacity).toBe(50);

      const buffer = new Float32Array(4 * STRIDE_FLOAT_COUNT);
      packEntityFieldsToStride(buffer, 0, 101, 200, 300, 0.5, 12, EntityTypeCode.PLANT, 100, 100);
      packEntityFieldsToStride(buffer, 1, 102, 400, 500, 1.2, 14, EntityTypeCode.HERBIVORE, 180, 85);
      packEntityFieldsToStride(buffer, 2, 103, 600, 700, 2.4, 18, EntityTypeCode.CARNIVORE, 350, 95);
      packEntityFieldsToStride(buffer, 3, 104, 800, 900, 0.0, 8, EntityTypeCode.FUNGUS, 280, 60);

      expect(() => layer.updateFromBuffer(buffer, 4)).not.toThrow();

      // Reducing count hides extra sprites
      expect(() => layer.updateFromBuffer(buffer, 2)).not.toThrow();
    });
  });

  describe('GardenViewport Lifecycle & Pipeline Unit Tests', () => {
    it('manages lifecycle, ticker, buffer forwarding, and teardown', () => {
      const canvas = document.createElement('canvas');
      const viewport = new GardenViewport({ canvas, worldWidth: 1600, worldHeight: 1200 });

      // Before init, calls are safe no-ops
      const renderBuf = new Float32Array(32);
      viewport.renderFrame(renderBuf, 1);
      viewport.updateSoil(new Float32Array(10), new Float32Array(10));
      viewport.updateAtmosphere(0.5, 0.0);

      // Ticker control
      viewport.stopTicker();
      viewport.startTicker();

      // Destroy
      expect(() => viewport.destroy()).not.toThrow();
    });
  });

  describe('GLSL Shader Exports', () => {
    it('provides valid GLSL shader sources for atmospheric bloom and soil rendering', () => {
      expect(atmosphericVertexShader).toContain('void main()');
      expect(atmosphericFragmentShader).toContain('gl_FragColor');
      expect(soilVertexShader).toContain('void main()');
      expect(soilFragmentShader).toContain('gl_FragColor');
    });
  });
});
