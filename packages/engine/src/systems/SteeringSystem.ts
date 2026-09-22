/**
 * Chaos Garden - Craig Reynolds Steering Behaviors System
 *
 * Computes autonomous steering forces:
 * - Separation (repulsion from close neighbors, inversely proportional to distance squared)
 * - Alignment (matching velocity of flockmates)
 * - Cohesion (steering towards centroid of flockmates)
 * - Seeking (moving towards nearest edible food/prey)
 * - Fleeing (moving away from predators within perception radius)
 * - Wander (subtle deterministic pseudo-random drift)
 *
 * Implemented using pure scalar arithmetic on SoA columns with zero heap allocations.
 */

import { EntityTypeCode, type PRNG } from "@chaos-garden/shared";
import type { EntityPool } from "../ecs/EntityPool.js";
import type { ComponentStorage } from "../ecs/ComponentStorage.js";
import type { SpatialHashGrid } from "../spatial/SpatialHashGrid.js";

export class SteeringSystem {
  /**
   * Updates steering acceleration forces for all active mobile entities with toroidal boundary wrapping.
   */
  update(
    pool: EntityPool,
    storage: ComponentStorage,
    spatialGrid: SpatialHashGrid,
    prng: PRNG,
    gardenWidth: number = 1600,
    gardenHeight: number = 1200,
  ): void {
    const activeCount = pool.denseCount;
    const dense = pool.denseEntities;
    const halfW = gardenWidth * 0.5;
    const halfH = gardenHeight * 0.5;

    const types = storage.typeCodes;
    const posXs = storage.positionsX;
    const posYs = storage.positionsY;
    const velXs = storage.velocitiesX;
    const velYs = storage.velocitiesY;
    const accXs = storage.accelerationsX;
    const accYs = storage.accelerationsY;
    const maxSpeeds = storage.maxSpeeds;
    const maxForces = storage.maxForces;
    const perceptionRadiis = storage.perceptionRadii;
    const fleeRadiis = storage.fleeRadii;
    const flockWeights = storage.flockingWeights;
    const sizes = storage.sizes;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      const type = types[idx];

      // Plants and fungi are sessile (no locomotion)
      if (type === EntityTypeCode.PLANT || type === EntityTypeCode.FUNGUS) {
        continue;
      }

      const posX = posXs[idx];
      const posY = posYs[idx];
      const velX = velXs[idx];
      const velY = velYs[idx];
      const maxSpeed = maxSpeeds[idx];
      const maxForce = maxForces[idx];
      const perceptionRadius = perceptionRadiis[idx];
      const fleeRadius = fleeRadiis[idx];
      const flockWeight = flockWeights[idx];
      const entitySize = sizes[idx];

      let sepX = 0;
      let sepY = 0;
      let alignX = 0;
      let alignY = 0;
      let cohX = 0;
      let cohY = 0;
      let flockmatesCount = 0;

      let nearestTargetDistSq = Infinity;
      let targetDx = 0;
      let targetDy = 0;
      let hasTarget = false;

      let nearestPredatorDistSq = Infinity;
      let predatorDx = 0;
      let predatorDy = 0;
      let hasPredator = false;

      const perceptionRadiusSq = perceptionRadius * perceptionRadius;
      const fleeRadiusSq = fleeRadius * fleeRadius;
      const searchRadius = Math.max(perceptionRadius, fleeRadius);
      const searchRadiusSq = searchRadius * searchRadius;
      const neighborCount = spatialGrid.query(posX, posY, searchRadius);
      const neighbors = spatialGrid.queryBuffer;

      for (let n = 0; n < neighborCount; n++) {
        const otherIdx = neighbors[n];
        if (otherIdx === idx) continue;

        const otherX = posXs[otherIdx];
        let dx = otherX - posX;
        if (dx > halfW) dx -= gardenWidth;
        else if (dx < -halfW) dx += gardenWidth;
        const dxSq = dx * dx;
        if (dxSq > searchRadiusSq) continue;

        const otherY = posYs[otherIdx];
        let dy = otherY - posY;
        if (dy > halfH) dy -= gardenHeight;
        else if (dy < -halfH) dy += gardenHeight;
        const distSq = dxSq + dy * dy;

        if (distSq === 0 || distSq > searchRadiusSq) continue;

        const otherType = types[otherIdx];

        // 1. Separation from any entity that is too close (collision avoidance)
        const personalSpace = (entitySize + sizes[otherIdx]) * 1.2;
        if (distSq < personalSpace * personalSpace) {
          const dist = Math.sqrt(distSq);
          const invCube = 1 / (distSq * dist);
          sepX -= dx * invCube;
          sepY -= dy * invCube;
        }

        // 2. Flocking behaviors (same species / kingdom)
        if (flockWeight > 0 && otherType === type && distSq < perceptionRadiusSq) {
          flockmatesCount++;
          // Accumulate relative displacement vector to flockmate
          alignX += velXs[otherIdx];
          alignY += velYs[otherIdx];
          cohX += dx;
          cohY += dy;
        }

        // 3. Herbivore targeting (seek plants) & predator avoidance (flee carnivores)
        if (type === EntityTypeCode.HERBIVORE) {
          if (otherType === EntityTypeCode.PLANT && distSq < perceptionRadiusSq) {
            if (distSq < nearestTargetDistSq) {
              nearestTargetDistSq = distSq;
              targetDx = dx;
              targetDy = dy;
              hasTarget = true;
            }
          } else if (otherType === EntityTypeCode.CARNIVORE && distSq < fleeRadiusSq) {
            if (distSq < nearestPredatorDistSq) {
              nearestPredatorDistSq = distSq;
              predatorDx = dx;
              predatorDy = dy;
              hasPredator = true;
            }
          }
        }

        // 4. Carnivore targeting (hunt herbivores)
        if (type === EntityTypeCode.CARNIVORE) {
          if (otherType === EntityTypeCode.HERBIVORE && distSq < perceptionRadiusSq) {
            if (distSq < nearestTargetDistSq) {
              nearestTargetDistSq = distSq;
              targetDx = dx;
              targetDy = dy;
              hasTarget = true;
            }
          }
        }
      }

      let totalSteerX = 0;
      let totalSteerY = 0;

      // Apply Separation force
      const sepLen = Math.sqrt(sepX * sepX + sepY * sepY);
      if (sepLen > 0) {
        totalSteerX += (sepX / sepLen) * maxSpeed * 1.5;
        totalSteerY += (sepY / sepLen) * maxSpeed * 1.5;
      }

      // Apply Alignment and Cohesion forces
      if (flockmatesCount > 0 && flockWeight > 0) {
        // Alignment
        alignX /= flockmatesCount;
        alignY /= flockmatesCount;
        const alignLen = Math.sqrt(alignX * alignX + alignY * alignY);
        if (alignLen > 0) {
          totalSteerX += (alignX / alignLen) * maxSpeed * flockWeight;
          totalSteerY += (alignY / alignLen) * maxSpeed * flockWeight;
        }

        // Cohesion towards toroidal centroid
        cohX /= flockmatesCount;
        cohY /= flockmatesCount;
        const cohLen = Math.sqrt(cohX * cohX + cohY * cohY);
        if (cohLen > 0) {
          totalSteerX += (cohX / cohLen) * maxSpeed * flockWeight * 0.8;
          totalSteerY += (cohY / cohLen) * maxSpeed * flockWeight * 0.8;
        }
      }

      // Apply Seeking target force (edible prey or plant)
      if (hasTarget) {
        const seekDist = Math.sqrt(nearestTargetDistSq);
        if (seekDist > 0) {
          totalSteerX += (targetDx / seekDist) * maxSpeed * 1.2;
          totalSteerY += (targetDy / seekDist) * maxSpeed * 1.2;
        }
      }

      // Apply Fleeing predator force (high priority emergency repulsion)
      if (hasPredator) {
        const fleeDist = Math.sqrt(nearestPredatorDistSq);
        if (fleeDist > 0) {
          const fleeDx = -predatorDx;
          const fleeDy = -predatorDy;
          totalSteerX += (fleeDx / fleeDist) * maxSpeed * 2.5;
          totalSteerY += (fleeDy / fleeDist) * maxSpeed * 2.5;
        }
      }

      // Add gentle wander drift if no target or predator
      if (!hasTarget && !hasPredator) {
        const angle = prng() * Math.PI * 2;
        totalSteerX += Math.cos(angle) * maxSpeed * 0.3;
        totalSteerY += Math.sin(angle) * maxSpeed * 0.3;
      }

      // Calculate steering force = desired - velocity, clamped to maxForce
      let steerX = totalSteerX - velX;
      let steerY = totalSteerY - velY;
      const steerLenSq = steerX * steerX + steerY * steerY;

      if (steerLenSq > maxForce * maxForce) {
        const steerLen = Math.sqrt(steerLenSq);
        steerX = (steerX / steerLen) * maxForce;
        steerY = (steerY / steerLen) * maxForce;
      }

      accXs[idx] += steerX;
      accYs[idx] += steerY;
    }
  }
}
