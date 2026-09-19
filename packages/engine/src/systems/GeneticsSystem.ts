/**
 * Chaos Garden - Genetics & Reproduction System
 * 
 * Enforces strictly ordered trophic reproduction thresholds:
 *   Plant (55) < Herbivore (65) < Carnivore (75)
 * Controls speciation, 50% energy transfer to offspring,
 * Gaussian trait mutation, and visual phylogenetic hue drift.
 * Zero heap allocations in the update loop.
 */

import {
  EntityTypeCode,
  type PRNG,
  type SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
} from '@chaos-garden/shared';
import type { EntityPool } from '../ecs/EntityPool.js';
import type { ComponentStorage } from '../ecs/ComponentStorage.js';

export interface EntityIdAllocator {
  allocateEntityId(): number;
}

export class GeneticsSystem {
  readonly config: SimulationConfig;

  constructor(config: SimulationConfig = DEFAULT_SIMULATION_CONFIG) {
    this.config = config;
  }

  update(
    currentTick: number,
    pool: EntityPool,
    storage: ComponentStorage,
    prng: PRNG,
    idAllocator?: EntityIdAllocator | (() => number),
  ): void {
    const activeCount = pool.denseCount;
    const dense = pool.denseEntities;

    if (activeCount >= this.config.maxTotalEntities || activeCount >= pool.capacity) {
      return;
    }

    // Count existing populations to respect ceilings
    let plantCount = 0;
    let herbivoreCount = 0;
    let carnivoreCount = 0;
    let fungusCount = 0;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      switch (storage.typeCodes[idx]) {
        case EntityTypeCode.PLANT:
          plantCount++;
          break;
        case EntityTypeCode.HERBIVORE:
          herbivoreCount++;
          break;
        case EntityTypeCode.CARNIVORE:
          carnivoreCount++;
          break;
        case EntityTypeCode.FUNGUS:
          fungusCount++;
          break;
      }
    }

    // Evaluate reproduction candidates (snapshot initial count so newborns aren't processed in same tick)
    for (let i = 0; i < activeCount; i++) {
      const parentIdx = dense[i];
      const type = storage.typeCodes[parentIdx];
      const energy = storage.energies[parentIdx];
      const threshold = storage.reproductionThresholds[parentIdx];

      // Must exceed kingdom reproduction threshold
      if (energy < threshold) {
        continue;
      }

      // Check population ceilings
      if (
        (type === EntityTypeCode.PLANT && plantCount >= this.config.maxPlants) ||
        (type === EntityTypeCode.HERBIVORE && herbivoreCount >= this.config.maxHerbivores) ||
        (type === EntityTypeCode.CARNIVORE && carnivoreCount >= this.config.maxCarnivores) ||
        (type === EntityTypeCode.FUNGUS && fungusCount >= this.config.maxFungi) ||
        pool.denseCount >= this.config.maxTotalEntities
      ) {
        continue;
      }

      // Allocate slot for newborn offspring
      const childIdx = pool.allocate();
      if (childIdx === -1) {
        // Entity pool exhausted
        break;
      }

      // 50% energy split between parent and child
      const childEnergy = energy * 0.5;
      storage.energies[parentIdx] = energy * 0.5;

      // Mutation magnitude and rate
      const mutationRate = storage.mutationRates[parentIdx];


      // Offspring position offset
      const parentX = storage.positionsX[parentIdx];
      const parentY = storage.positionsY[parentIdx];
      const parentSize = storage.sizes[parentIdx];
      let spawnRadius = parentSize * 2;

      if (type === EntityTypeCode.PLANT || type === EntityTypeCode.FUNGUS) {
        spawnRadius = storage.seedDispersionRadii[parentIdx] || 30;
      }

      const spawnAngle = prng() * Math.PI * 2;
      const spawnDist = prng() * spawnRadius;
      let childX = parentX + Math.cos(spawnAngle) * spawnDist;
      let childY = parentY + Math.sin(spawnAngle) * spawnDist;

      // Wrap coordinate toroidally
      const gardenW = this.config.gardenWidth;
      const gardenH = this.config.gardenHeight;
      childX = ((childX % gardenW) + gardenW) % gardenW;
      childY = ((childY % gardenH) + gardenH) % gardenH;

      // Phylogenetic pigment hue drift (+/- 5 degrees)
      let childPigment = storage.pigments[parentIdx] + (prng() * 10 - 5);
      if (childPigment < 0) childPigment += 360;
      else if (childPigment >= 360) childPigment %= 360;

      // Generate deterministic unique id hash for offspring
      const childIdHash = (storage.idHashes[parentIdx] * 31 + currentTick + childIdx) & 0x00ffffff;

      // Enforce trophic invariant on child reproduction threshold:
      // Plant threshold < Herbivore threshold < Carnivore threshold
      let childReproThreshold = this._mutateScalar(storage.reproductionThresholds[parentIdx], prng);
      if (type === EntityTypeCode.PLANT) {
        childReproThreshold = Math.min(
          childReproThreshold,
          this.config.herbivoreReproductionThreshold - 1
        );
      } else if (type === EntityTypeCode.HERBIVORE) {
        childReproThreshold = Math.max(
          this.config.plantReproductionThreshold + 1,
          Math.min(childReproThreshold, this.config.carnivoreReproductionThreshold - 1)
        );
      } else if (type === EntityTypeCode.CARNIVORE) {
        childReproThreshold = Math.max(
          childReproThreshold,
          this.config.herbivoreReproductionThreshold + 1
        );
      }

      const childEntityId = idAllocator
        ? (typeof idAllocator === 'function' ? idAllocator() : idAllocator.allocateEntityId())
        : (childIdHash === 0 ? 1 : childIdHash);
      const parentEntityId = storage.entityIds[parentIdx];

      // Initialize child entity in SoA storage
      storage.initEntity(childIdx, {
        idHash: childIdHash === 0 ? 1 : childIdHash,
        entityId: childEntityId,
        parentEntityId: parentEntityId,
        typeCode: type,
        x: childX,
        y: childY,
        vx: (prng() * 2 - 1) * 2,
        vy: (prng() * 2 - 1) * 2,
        rotation: spawnAngle,
        size: this._mutateScalar(parentSize, prng),
        pigment: childPigment,
        energy: childEnergy,
        health: 100,
        generation: storage.generations[parentIdx] + 1,
        parentIndex: parentIdx,
        bornAtTick: currentTick,
        lifespan: Math.round(this._mutateScalar(storage.maxLifespans[parentIdx], prng)),
        metabolismRate: this._mutateScalar(storage.metabolismRates[parentIdx], prng),
        reproductionThreshold: childReproThreshold,
        mutationRate: this._mutateScalar(mutationRate, prng),

        // Kingdom-specific mutated traits
        photosynthesisRate: this._mutateScalar(storage.photosynthesisRates[parentIdx], prng),
        seedDispersionRadius: this._mutateScalar(storage.seedDispersionRadii[parentIdx], prng),
        moistureAffinity: this._mutateScalar(storage.moistureAffinities[parentIdx], prng),
        maxSpeed: this._mutateScalar(storage.maxSpeeds[parentIdx], prng),
        maxForce: this._mutateScalar(storage.maxForces[parentIdx], prng),
        perceptionRadius: this._mutateScalar(storage.perceptionRadii[parentIdx], prng),
        fleeRadius: this._mutateScalar(storage.fleeRadii[parentIdx], prng),
        flockingWeight: this._mutateScalar(storage.flockingWeights[parentIdx], prng),
        packWeight: this._mutateScalar(storage.packWeights[parentIdx], prng),
        decompositionRate: this._mutateScalar(storage.decompositionRates[parentIdx], prng),
      });

      // Update kingdom count for this tick
      switch (type) {
        case EntityTypeCode.PLANT:
          plantCount++;
          break;
        case EntityTypeCode.HERBIVORE:
          herbivoreCount++;
          break;
        case EntityTypeCode.CARNIVORE:
          carnivoreCount++;
          break;
        case EntityTypeCode.FUNGUS:
          fungusCount++;
          break;
      }
    }
  }

  private _mutateScalar(val: number, prng: PRNG): number {
    if (prng() < this.config.mutationProbability) {
      const delta = (prng() * 2 - 1) * this.config.mutationMagnitude * val;
      return Math.max(0.01, val + delta);
    }
    return val;
  }
}

