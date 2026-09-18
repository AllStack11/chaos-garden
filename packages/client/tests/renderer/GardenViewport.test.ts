import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { CameraController } from '../../src/renderer/CameraController.js';
import { EntityTypeCode, packEntityFieldsToStride, STRIDE_FLOAT_COUNT } from '@chaos-garden/shared';

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

