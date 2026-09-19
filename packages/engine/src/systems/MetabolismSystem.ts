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

export const GRAZING_INTERACTION_RADIUS_OFFSET = 16;
export const PREDATION_INTERACTION_RADIUS_OFFSET = 14;

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

    const types = storage.typeCodes;
    const posXs = storage.positionsX;
    const posYs = storage.positionsY;
    const sizes = storage.sizes;
    const energies = storage.energies;
    const healths = storage.healths;
    const metabolismRates = storage.metabolismRates;
    const photosynthesisRates = storage.photosynthesisRates;
    const decompositionRates = storage.decompositionRates;

    const dtFactor = dt * 60;
    const starvationDrain = this.starvationDecayRate * dtFactor;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      const type = types[idx];
      const posX = posXs[idx];
      const posY = posYs[idx];
      const size = sizes[idx];

      // 1. Basal metabolic drain
      energies[idx] -= metabolismRates[idx] * dtFactor;

      // 2. Kingdom-specific energy intake
      switch (type) {
        case EntityTypeCode.PLANT: {
          // Photosynthesis driven by sunlight and soil nutrients
          const moisture = soil.getMoisture(posX, posY);
          const nitrates = soil.getNitrates(posX, posY);
          const environmentalFactor = moisture * 0.6 + nitrates * 0.4;
          const photoGain =
            this.basePhotosynthesisRate *
            photosynthesisRates[idx] *
            environmentalFactor *
            dtFactor;

          const e = energies[idx] + photoGain;
          energies[idx] = e > 100 ? 100 : e;

          // Plants drink small amounts of moisture and nitrates
          soil.consumeMoisture(posX, posY, 0.0005);
          soil.consumeNitrates(posX, posY, 0.0002);
          break;
        }

        case EntityTypeCode.HERBIVORE: {
          // Grazing on nearby plants if energy is not full
          if (energies[idx] < 95) {
            const targetIdx = spatialGrid.findNearestTarget(
              posX,
              posY,
              size + GRAZING_INTERACTION_RADIUS_OFFSET,
              EntityTypeCode.PLANT,
              storage,
              5
            );
            if (targetIdx !== -1) {
              const targetEnergy = energies[targetIdx];
              const bite = targetEnergy < 15 ? targetEnergy : 15;
              energies[targetIdx] -= bite;
              healths[targetIdx] -= bite * 0.4;
              const newE = energies[idx] + bite;
              energies[idx] = newE > 100 ? 100 : newE;
            }
          }
          break;
        }

        case EntityTypeCode.CARNIVORE: {
          // Predation on nearby herbivores
          if (energies[idx] < 90) {
            const targetIdx = spatialGrid.findNearestTarget(
              posX,
              posY,
              size + PREDATION_INTERACTION_RADIUS_OFFSET,
              EntityTypeCode.HERBIVORE,
              storage,
              0
            );
            if (targetIdx !== -1) {
              healths[targetIdx] -= 30;
              const newE = energies[idx] + 20;
              energies[idx] = newE > 100 ? 100 : newE;
            }
          }
          break;
        }

        case EntityTypeCode.FUNGUS: {
          // Decomposition: absorb nutrients from soil nitrates
          const decompRate = decompositionRates[idx];
          const absorbed = soil.consumeNitrates(posX, posY, decompRate * 0.001);
          const newE = energies[idx] + absorbed * 80;
          energies[idx] = newE > 100 ? 100 : newE;
          break;
        }
      }

      // 3. Starvation check
      if (energies[idx] <= 0) {
        energies[idx] = 0;
        healths[idx] -= starvationDrain;
      }
    }
  }
}
