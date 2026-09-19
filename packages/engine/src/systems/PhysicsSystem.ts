/**
 * Chaos Garden - Physics Integration & Toroidal Wrapping System
 * 
 * Updates velocities, positions, heading rotations, and wraps
 * coordinates toroidally across world boundaries.
 * Zero heap allocations.
 */

import type { EntityPool } from '../ecs/EntityPool.js';
import type { ComponentStorage } from '../ecs/ComponentStorage.js';

export class PhysicsSystem {
  readonly worldWidth: number;
  readonly worldHeight: number;

  constructor(worldWidth: number = 1600, worldHeight: number = 1200) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  update(dt: number, pool: EntityPool, storage: ComponentStorage): void {
    const activeCount = pool.denseCount;
    const dense = pool.denseEntities;
    const width = this.worldWidth;
    const height = this.worldHeight;

    const maxSpeeds = storage.maxSpeeds;
    const accX = storage.accelerationsX;
    const accY = storage.accelerationsY;
    const velX = storage.velocitiesX;
    const velY = storage.velocitiesY;
    const posX = storage.positionsX;
    const posY = storage.positionsY;
    const rotations = storage.rotations;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];

      const maxSpeed = maxSpeeds[idx];
      if (maxSpeed === 0) {
        accX[idx] = 0;
        accY[idx] = 0;
        continue;
      }

      // Integrate acceleration into velocity
      let vx = velX[idx] + accX[idx] * dt;
      let vy = velY[idx] + accY[idx] * dt;

      // Reset acceleration for next tick
      accX[idx] = 0;
      accY[idx] = 0;

      const speedSq = vx * vx + vy * vy;
      if (speedSq > maxSpeed * maxSpeed) {
        const speed = Math.sqrt(speedSq);
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
      }

      velX[idx] = vx;
      velY[idx] = vy;

      // Integrate velocity into position
      let px = posX[idx] + vx * dt;
      let py = posY[idx] + vy * dt;

      // Toroidal boundary wrapping (fast addition/subtraction)
      if (px < 0) px += width;
      else if (px >= width) px -= width;

      if (py < 0) py += height;
      else if (py >= height) py -= height;

      posX[idx] = px;
      posY[idx] = py;

      // Update rotation heading angle if moving
      if (vx !== 0 || vy !== 0) {
        rotations[idx] = Math.atan2(vy, vx);
      }
    }
  }
}
