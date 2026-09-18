/**
 * Chaos Garden - Camera & Viewport Controller
 *
 * Provides smooth pan/zoom with inertial damping, cursor-centered zooming (0.25x - 5.0x),
 * world-to-screen transforms, and smooth follow-cam tracking for selected organisms.
 */

import { Container } from 'pixi.js';

export interface CameraOptions {
  worldWidth?: number;
  worldHeight?: number;
  minZoom?: number;
  maxZoom?: number;
}

export class CameraController {
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly minZoom: number;
  readonly maxZoom: number;

  private stage: Container;

  // Viewport dimensions in CSS pixels
  private viewportWidth: number = 800;
  private viewportHeight: number = 600;

  // Camera state
  private zoom: number = 1.0;
  private targetZoom: number = 1.0;
  private posX: number = 0;
  private posY: number = 0;
  private targetPosX: number = 0;
  private targetPosY: number = 0;

  // Inertial velocity
  private velocityX: number = 0;
  private velocityY: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private lastDragX: number = 0;
  private lastDragY: number = 0;

  // Follow cam
  private isFollowing: boolean = false;
  private followTarget: { x: number; y: number } | null = null;

  constructor(stage: Container, options: CameraOptions = {}) {
    this.stage = stage;
    this.worldWidth = options.worldWidth ?? 1600;
    this.worldHeight = options.worldHeight ?? 1200;
    this.minZoom = options.minZoom ?? 0.25;
    this.maxZoom = options.maxZoom ?? 5.0;
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.clampBounds();
  }

  get currentZoom(): number {
    return this.zoom;
  }

  get isFollowActive(): boolean {
    return this.isFollowing;
  }

  startDrag(screenX: number, screenY: number): void {
    this.isDragging = true;
    this.disengageFollow();
    this.dragStartX = screenX;
    this.dragStartY = screenY;
    this.lastDragX = screenX;
    this.lastDragY = screenY;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  drag(screenX: number, screenY: number): void {
    if (!this.isDragging) return;

    const dx = screenX - this.lastDragX;
    const dy = screenY - this.lastDragY;

    this.posX += dx;
    this.posY += dy;
    this.targetPosX = this.posX;
    this.targetPosY = this.posY;

    // Track instantaneous velocity for inertia
    this.velocityX = dx;
    this.velocityY = dy;

    this.lastDragX = screenX;
    this.lastDragY = screenY;

    this.clampBounds();
    this.applyTransform();
  }

  endDrag(): void {
    this.isDragging = false;
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const oldZoom = this.zoom;
    const newZoom = Math.min(
      this.maxZoom,
      Math.max(this.minZoom, oldZoom * factor),
    );

    if (newZoom === oldZoom) return;

    // Zoom centered on cursor:
    // (screenX - posX) / oldZoom == (screenX - newPosX) / newZoom
    const scaleFactor = newZoom / oldZoom;
    this.posX = screenX - (screenX - this.posX) * scaleFactor;
    this.posY = screenY - (screenY - this.posY) * scaleFactor;
    this.targetPosX = this.posX;
    this.targetPosY = this.posY;
    this.zoom = newZoom;
    this.targetZoom = newZoom;

    this.clampBounds();
    this.applyTransform();
  }

  setFollowTarget(pos: { x: number; y: number } | null): void {
    if (pos) {
      this.isFollowing = true;
      this.followTarget = pos;
    } else {
      this.disengageFollow();
    }
  }

  disengageFollow(): void {
    this.isFollowing = false;
    this.followTarget = null;
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const wx = (screenX - this.posX) / this.zoom;
    const wy = (screenY - this.posY) / this.zoom;
    return { x: wx, y: wy };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const sx = worldX * this.zoom + this.posX;
    const sy = worldY * this.zoom + this.posY;
    return { x: sx, y: sy };
  }

  centerOn(worldX: number, worldY: number): void {
    this.posX = this.viewportWidth / 2 - worldX * this.zoom;
    this.posY = this.viewportHeight / 2 - worldY * this.zoom;
    this.targetPosX = this.posX;
    this.targetPosY = this.posY;
    this.clampBounds();
    this.applyTransform();
  }

  /**
   * Per-frame update for inertia and follow-cam lerping.
   */
  update(): void {
    // 1. Follow-cam interpolation
    if (this.isFollowing && this.followTarget) {
      const targetScreenX = this.viewportWidth / 2 - this.followTarget.x * this.zoom;
      const targetScreenY = this.viewportHeight / 2 - this.followTarget.y * this.zoom;

      // Smooth lerp (0.08)
      this.posX += (targetScreenX - this.posX) * 0.08;
      this.posY += (targetScreenY - this.posY) * 0.08;
    } else if (!this.isDragging) {
      // 2. Inertial damping on release
      if (Math.abs(this.velocityX) > 0.05 || Math.abs(this.velocityY) > 0.05) {
        this.posX += this.velocityX;
        this.posY += this.velocityY;
        this.velocityX *= 0.92;
        this.velocityY *= 0.92;
        this.clampBounds();
      }
    }

    this.applyTransform();
  }

  private clampBounds(): void {
    // Allow padding around the world boundary so user can comfortably view edges
    const padding = 200 * this.zoom;
    const minX = this.viewportWidth - (this.worldWidth * this.zoom + padding);
    const maxX = padding;
    const minY = this.viewportHeight - (this.worldHeight * this.zoom + padding);
    const maxY = padding;

    this.posX = Math.min(maxX, Math.max(minX, this.posX));
    this.posY = Math.min(maxY, Math.max(minY, this.posY));
  }

  private applyTransform(): void {
    this.stage.scale.set(this.zoom, this.zoom);
    this.stage.position.set(this.posX, this.posY);
  }
}

