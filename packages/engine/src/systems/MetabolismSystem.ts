/**
 * Chaos Garden - Metabolism, Grazing, Predation & Decomposition System
 * 
 * Manages basal metabolic energy consumption, plant photosynthesis,
 * herbivore grazing, carnivore predation, fungal nutrient recycling,
 * and starvation health depletion.
 * Zero heap allocations in the update loop.
 */

import { EntityTypeCode } from '@chaos-garden/shared';
import type { EntityPool } from '../ecs/EntityPool.js';
import type { ComponentStorage } from '../ecs/ComponentStorage.js';
import type { SpatialHashGrid } from '../spatial/SpatialHashGrid.js';
import type { SoilGrid } from '../environment/SoilGrid.js';

export class MetabolismSystem {
  readonly basePhotosynthesisRate: number;
  readonly starvationDecayRate: number;

  constructor(
    basePhotosynthesisRate: number = 0.06,
    starvationDecayRate: number = 0.5
  ) {
    this.basePhotosynthesisRate = basePhotosynthesisRate;
    this.starvationDecayRate = starvationDecayRate;
  }

  update(
    dt: number,
    pool: EntityPool,
    storage: ComponentStorage,
    spatialGrid: SpatialHashGrid,
    soil: SoilGrid
  ): void {
    const activeCount = pool.denseCount;
    const dense = pool.denseEntities;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      const type = storage.typeCodes[idx];
      const posX = storage.positionsX[idx];
      const posY = storage.positionsY[idx];
      const size = storage.sizes[idx];

      // 1. Basal metabolic drain
      storage.energies[idx] -= storage.metabolismRates[idx] * dt * 60;

      // 2. Kingdom-specific energy intake
      switch (type) {
        case EntityTypeCode.PLANT: {
          // Photosynthesis driven by sunlight and soil nutrients
          const moisture = soil.getMoisture(posX, posY);
          const nitrates = soil.getNitrates(posX, posY);
          const environmentalFactor = moisture * 0.6 + nitrates * 0.4;
          const photoGain =
            this.basePhotosynthesisRate *
            storage.photosynthesisRates[idx] *
            environmentalFactor *
            dt *
            60;

          storage.energies[idx] = Math.min(100, storage.energies[idx] + photoGain);

          // Plants drink small amounts of moisture and nitrates
          soil.consumeMoisture(posX, posY, 0.0005);
          soil.consumeNitrates(posX, posY, 0.0002);
          break;
        }

        case EntityTypeCode.HERBIVORE: {
          // Grazing on nearby plants if energy is not full
          if (storage.energies[idx] < 95) {
            const count = spatialGrid.query(posX, posY, size + 16);
            const neighbors = spatialGrid.queryBuffer;
            for (let n = 0; n < count; n++) {
              const targetIdx = neighbors[n];
              if (storage.typeCodes[targetIdx] === EntityTypeCode.PLANT) {
                const targetEnergy = storage.energies[targetIdx];
                if (targetEnergy > 5) {
                  const bite = Math.min(15, targetEnergy);
                  storage.energies[targetIdx] -= bite;
                  storage.healths[targetIdx] -= bite * 0.4;
                  storage.energies[idx] = Math.min(100, storage.energies[idx] + bite);
                  break;
                }
              }
            }
          }
          break;
        }

        case EntityTypeCode.CARNIVORE: {
          // Predation on nearby herbivores
          if (storage.energies[idx] < 90) {
            const count = spatialGrid.query(posX, posY, size + 14);
            const neighbors = spatialGrid.queryBuffer;
            for (let n = 0; n < count; n++) {
              const targetIdx = neighbors[n];
              if (storage.typeCodes[targetIdx] === EntityTypeCode.HERBIVORE) {
                const targetHealth = storage.healths[targetIdx];
                if (targetHealth > 0) {
                  const strikeDamage = 30;
                  storage.healths[targetIdx] -= strikeDamage;
                  const meatEnergy = 20;
                  storage.energies[idx] = Math.min(100, storage.energies[idx] + meatEnergy);
                  break;
                }
              }
            }
          }
          break;
        }

        case EntityTypeCode.FUNGUS: {
          // Decomposition: absorb nutrients from soil nitrates
          const decompRate = storage.decompositionRates[idx];
          const absorbed = soil.consumeNitrates(posX, posY, decompRate * 0.001);
          storage.energies[idx] = Math.min(100, storage.energies[idx] + absorbed * 80);
          break;
        }
      }

      // 3. Starvation check
      if (storage.energies[idx] <= 0) {
        storage.energies[idx] = 0;
        storage.healths[idx] -= this.starvationDecayRate * dt * 60;
      }
    }
  }
}
