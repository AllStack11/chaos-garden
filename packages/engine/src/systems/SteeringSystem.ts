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

import { EntityTypeCode, type PRNG } from '@chaos-garden/shared';
import type { EntityPool } from '../ecs/EntityPool.js';
import type { ComponentStorage } from '../ecs/ComponentStorage.js';
import type { SpatialHashGrid } from '../spatial/SpatialHashGrid.js';

export class SteeringSystem {
  /**
   * Updates steering acceleration forces for all active mobile entities.
   */
  update(
    pool: EntityPool,
    storage: ComponentStorage,
    spatialGrid: SpatialHashGrid,
    prng: PRNG
  ): void {
    const activeCount = pool.denseCount;
    const dense = pool.denseEntities;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      const type = storage.typeCodes[idx];

      // Plants and fungi are sessile (no locomotion)
      if (type === EntityTypeCode.PLANT || type === EntityTypeCode.FUNGUS) {
        continue;
      }

      const posX = storage.positionsX[idx];
      const posY = storage.positionsY[idx];
      const velX = storage.velocitiesX[idx];
      const velY = storage.velocitiesY[idx];
      const maxSpeed = storage.maxSpeeds[idx];
      const maxForce = storage.maxForces[idx];
      const perceptionRadius = storage.perceptionRadii[idx];
      const fleeRadius = storage.fleeRadii[idx];
      const flockWeight = storage.flockingWeights[idx];
      const entitySize = storage.sizes[idx];

      let sepX = 0;
      let sepY = 0;
      let alignX = 0;
      let alignY = 0;
      let cohX = 0;
      let cohY = 0;
      let flockmatesCount = 0;

      let nearestTargetDistSq = Infinity;
      let targetX = 0;
      let targetY = 0;
      let hasTarget = false;

      let nearestPredatorDistSq = Infinity;
      let predatorX = 0;
      let predatorY = 0;
      let hasPredator = false;

      const searchRadius = Math.max(perceptionRadius, fleeRadius);
      const searchRadiusSq = searchRadius * searchRadius;
      const neighborCount = spatialGrid.query(posX, posY, searchRadius);
      const neighbors = spatialGrid.queryBuffer;

      for (let n = 0; n < neighborCount; n++) {
        const otherIdx = neighbors[n];
        if (otherIdx === idx) continue;

        const otherX = storage.positionsX[otherIdx];
        const otherY = storage.positionsY[otherIdx];
        const otherType = storage.typeCodes[otherIdx];

        const dx = otherX - posX;
        const dy = otherY - posY;
        const distSq = dx * dx + dy * dy;

        if (distSq === 0 || distSq > searchRadiusSq) continue;


        // 1. Separation from any entity that is too close (collision avoidance)
        const personalSpace = (entitySize + storage.sizes[otherIdx]) * 1.2;
        if (distSq < personalSpace * personalSpace) {
          const invDist = 1 / Math.sqrt(distSq);
          // Inverse-square repulsion
          sepX -= (dx * invDist) / distSq;
          sepY -= (dy * invDist) / distSq;
        }

        // 2. Flocking behaviors (same species / kingdom)
        if (otherType === type && distSq < perceptionRadius * perceptionRadius) {
          flockmatesCount++;
          alignX += storage.velocitiesX[otherIdx];
          alignY += storage.velocitiesY[otherIdx];
          cohX += otherX;
          cohY += otherY;
        }

        // 3. Herbivore targeting (seek plants) & predator avoidance (flee carnivores)
        if (type === EntityTypeCode.HERBIVORE) {
          if (otherType === EntityTypeCode.PLANT && distSq < perceptionRadius * perceptionRadius) {
            if (distSq < nearestTargetDistSq) {
              nearestTargetDistSq = distSq;
              targetX = otherX;
              targetY = otherY;
              hasTarget = true;
            }
          } else if (otherType === EntityTypeCode.CARNIVORE && distSq < fleeRadius * fleeRadius) {
            if (distSq < nearestPredatorDistSq) {
              nearestPredatorDistSq = distSq;
              predatorX = otherX;
              predatorY = otherY;
              hasPredator = true;
            }
          }
        }

        // 4. Carnivore targeting (hunt herbivores)
        if (type === EntityTypeCode.CARNIVORE) {
          if (otherType === EntityTypeCode.HERBIVORE && distSq < perceptionRadius * perceptionRadius) {
            if (distSq < nearestTargetDistSq) {
              nearestTargetDistSq = distSq;
              targetX = otherX;
              targetY = otherY;
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

        // Cohesion
        cohX = cohX / flockmatesCount - posX;
        cohY = cohY / flockmatesCount - posY;
        const cohLen = Math.sqrt(cohX * cohX + cohY * cohY);
        if (cohLen > 0) {
          totalSteerX += (cohX / cohLen) * maxSpeed * flockWeight * 0.8;
          totalSteerY += (cohY / cohLen) * maxSpeed * flockWeight * 0.8;
        }
      }

      // Apply Seeking target force (edible prey or plant)
      if (hasTarget) {
        const seekDx = targetX - posX;
        const seekDy = targetY - posY;
        const seekDist = Math.sqrt(seekDx * seekDx + seekDy * seekDy);
        if (seekDist > 0) {
          totalSteerX += (seekDx / seekDist) * maxSpeed * 1.2;
          totalSteerY += (seekDy / seekDist) * maxSpeed * 1.2;
        }
      }

      // Apply Fleeing predator force (high priority emergency repulsion)
      if (hasPredator) {
        const fleeDx = posX - predatorX;
        const fleeDy = posY - predatorY;
        const fleeDist = Math.sqrt(fleeDx * fleeDx + fleeDy * fleeDy);
        if (fleeDist > 0) {
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

      storage.accelerationsX[idx] += steerX;
      storage.accelerationsY[idx] += steerY;
    }
  }
}
