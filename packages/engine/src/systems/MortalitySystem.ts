/**
 * Chaos Garden - Senescence & Mortality System
 * 
 * Manages biological aging, senescent decay, trauma death,
 * carcass biomass recycling into soil nitrates, and entity slot deallocation.
 * Iterates backwards across dense array for safe O(1) swap-and-pop deallocation.
 */

import type { EntityPool } from '../ecs/EntityPool.js';
import type { ComponentStorage } from '../ecs/ComponentStorage.js';
import type { SoilGrid } from '../environment/SoilGrid.js';

export class MortalitySystem {
  /**
   * Advances entity ages and deallocates dead organisms,
   * returning remaining biomass to the soil grid as nitrates.
   * 
   * @returns Number of entities that died this tick.
   */
  update(
    pool: EntityPool,
    storage: ComponentStorage,
    soil: SoilGrid
  ): number {
    let deathCount = 0;

    // Iterate backwards so dense swap-and-pop does not perturb unprocessed indices
    for (let i = pool.denseCount - 1; i >= 0; i--) {
      const idx = pool.denseEntities[i];

      // Increment age
      storage.ages[idx]++;

      const isOld = storage.ages[idx] >= storage.maxLifespans[idx];
      const isDead = storage.healths[idx] <= 0;

      if (isOld || isDead) {
        // Return remaining biomass into soil nitrates
        const biomass = Math.max(0.05, (storage.energies[idx] + Math.max(0, storage.healths[idx])) * 0.002);
        soil.depositNitrates(storage.positionsX[idx], storage.positionsY[idx], biomass);

        // Reset storage slot and recycle into free list
        storage.resetEntity(idx);
        pool.free(idx);
        deathCount++;
      }
    }

    return deathCount;
  }
}

