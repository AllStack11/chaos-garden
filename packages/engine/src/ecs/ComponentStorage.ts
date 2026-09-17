/**
 * Chaos Garden - Struct-of-Arrays (SoA) Component Storage
 * 
 * Contiguous TypedArray columns dimensioned to maxEntities.
 * Eliminates JavaScript object allocation overhead and guarantees
 * sequential cache line prefetching across simulation ticks.
 */

import { EntityTypeCode } from '@chaos-garden/shared';

export interface EntityInitParams {
  idHash: number;
  typeCode: EntityTypeCode;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  rotation?: number;
  size: number;
  pigment: number;
  energy?: number;
  health?: number;
  generation?: number;
  parentIndex?: number;
  bornAtTick?: number;
  lifespan?: number;
  metabolismRate?: number;
  reproductionThreshold?: number;
  mutationRate?: number;

  // Kingdom-specific traits
  photosynthesisRate?: number;
  seedDispersionRadius?: number;
  moistureAffinity?: number;
  maxSpeed?: number;
  maxForce?: number;
  perceptionRadius?: number;
  fleeRadius?: number;
  flockingWeight?: number;
  packWeight?: number;
  decompositionRate?: number;
}

export class ComponentStorage {
  readonly capacity: number;

  // 1. Spatial
  readonly positionsX: Float32Array;
  readonly positionsY: Float32Array;
  readonly velocitiesX: Float32Array;
  readonly velocitiesY: Float32Array;
  readonly accelerationsX: Float32Array;
  readonly accelerationsY: Float32Array;
  readonly rotations: Float32Array;

  // 2. Vitals
  readonly energies: Float32Array;
  readonly healths: Float32Array;
  readonly ages: Uint32Array;
  readonly maxLifespans: Uint32Array;

  // 3. Taxonomy
  readonly typeCodes: Uint8Array;
  readonly sizes: Float32Array;
  readonly pigments: Float32Array;
  readonly generations: Uint16Array;

  // 4. Chromosomes
  readonly metabolismRates: Float32Array;
  readonly reproductionThresholds: Float32Array;
  readonly mutationRates: Float32Array;

  // 5. Kingdom Traits
  readonly photosynthesisRates: Float32Array;
  readonly seedDispersionRadii: Float32Array;
  readonly moistureAffinities: Float32Array;
  readonly maxSpeeds: Float32Array;
  readonly maxForces: Float32Array;
  readonly perceptionRadii: Float32Array;
  readonly fleeRadii: Float32Array;
  readonly flockingWeights: Float32Array;
  readonly packWeights: Float32Array;
  readonly decompositionRates: Float32Array;

  // 6. Identity & Lineage
  readonly idHashes: Uint32Array;
  readonly parentIndices: Int32Array;
  readonly bornAtTicks: Uint32Array;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error(`ComponentStorage capacity must be positive, received ${capacity}`);
    }
    this.capacity = capacity;

    // Allocate continuous typed arrays
    this.positionsX = new Float32Array(capacity);
    this.positionsY = new Float32Array(capacity);
    this.velocitiesX = new Float32Array(capacity);
    this.velocitiesY = new Float32Array(capacity);
    this.accelerationsX = new Float32Array(capacity);
    this.accelerationsY = new Float32Array(capacity);
    this.rotations = new Float32Array(capacity);

    this.energies = new Float32Array(capacity);
    this.healths = new Float32Array(capacity);
    this.ages = new Uint32Array(capacity);
    this.maxLifespans = new Uint32Array(capacity);

    this.typeCodes = new Uint8Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.pigments = new Float32Array(capacity);
    this.generations = new Uint16Array(capacity);

    this.metabolismRates = new Float32Array(capacity);
    this.reproductionThresholds = new Float32Array(capacity);
    this.mutationRates = new Float32Array(capacity);

    this.photosynthesisRates = new Float32Array(capacity);
    this.seedDispersionRadii = new Float32Array(capacity);
    this.moistureAffinities = new Float32Array(capacity);
    this.maxSpeeds = new Float32Array(capacity);
    this.maxForces = new Float32Array(capacity);
    this.perceptionRadii = new Float32Array(capacity);
    this.fleeRadii = new Float32Array(capacity);
    this.flockingWeights = new Float32Array(capacity);
    this.packWeights = new Float32Array(capacity);
    this.decompositionRates = new Float32Array(capacity);

    this.idHashes = new Uint32Array(capacity);
    this.parentIndices = new Int32Array(capacity);
    this.bornAtTicks = new Uint32Array(capacity);

    this.clearAll();
  }

  /**
   * Clears all arrays to default states (0s and -1 for parent pointers).
   */
  clearAll(): void {
    this.positionsX.fill(0);
    this.positionsY.fill(0);
    this.velocitiesX.fill(0);
    this.velocitiesY.fill(0);
    this.accelerationsX.fill(0);
    this.accelerationsY.fill(0);
    this.rotations.fill(0);

    this.energies.fill(0);
    this.healths.fill(0);
    this.ages.fill(0);
    this.maxLifespans.fill(0);

    this.typeCodes.fill(0);
    this.sizes.fill(0);
    this.pigments.fill(0);
    this.generations.fill(0);

    this.metabolismRates.fill(0);
    this.reproductionThresholds.fill(0);
    this.mutationRates.fill(0);

    this.photosynthesisRates.fill(0);
    this.seedDispersionRadii.fill(0);
    this.moistureAffinities.fill(0);
    this.maxSpeeds.fill(0);
    this.maxForces.fill(0);
    this.perceptionRadii.fill(0);
    this.fleeRadii.fill(0);
    this.flockingWeights.fill(0);
    this.packWeights.fill(0);
    this.decompositionRates.fill(0);

    this.idHashes.fill(0);
    this.parentIndices.fill(-1);
    this.bornAtTicks.fill(0);
  }

  /**
   * Resets an individual entity slot to zero/default values.
   */
  resetEntity(index: number): void {
    this.positionsX[index] = 0;
    this.positionsY[index] = 0;
    this.velocitiesX[index] = 0;
    this.velocitiesY[index] = 0;
    this.accelerationsX[index] = 0;
    this.accelerationsY[index] = 0;
    this.rotations[index] = 0;

    this.energies[index] = 0;
    this.healths[index] = 0;
    this.ages[index] = 0;
    this.maxLifespans[index] = 0;

    this.typeCodes[index] = 0;
    this.sizes[index] = 0;
    this.pigments[index] = 0;
    this.generations[index] = 0;

    this.metabolismRates[index] = 0;
    this.reproductionThresholds[index] = 0;
    this.mutationRates[index] = 0;

    this.photosynthesisRates[index] = 0;
    this.seedDispersionRadii[index] = 0;
    this.moistureAffinities[index] = 0;
    this.maxSpeeds[index] = 0;
    this.maxForces[index] = 0;
    this.perceptionRadii[index] = 0;
    this.fleeRadii[index] = 0;
    this.flockingWeights[index] = 0;
    this.packWeights[index] = 0;
    this.decompositionRates[index] = 0;

    this.idHashes[index] = 0;
    this.parentIndices[index] = -1;
    this.bornAtTicks[index] = 0;
  }

  /**
   * Initializes an allocated entity slot with concrete values.
   */
  initEntity(index: number, params: EntityInitParams): void {
    this.positionsX[index] = params.x;
    this.positionsY[index] = params.y;
    this.velocitiesX[index] = params.vx ?? 0;
    this.velocitiesY[index] = params.vy ?? 0;
    this.accelerationsX[index] = 0;
    this.accelerationsY[index] = 0;
    this.rotations[index] = params.rotation ?? 0;

    this.energies[index] = params.energy ?? 100;
    this.healths[index] = params.health ?? 100;
    this.ages[index] = 0;
    this.maxLifespans[index] = params.lifespan ?? 1000;

    this.typeCodes[index] = params.typeCode;
    this.sizes[index] = params.size;
    this.pigments[index] = params.pigment;
    this.generations[index] = params.generation ?? 1;

    this.metabolismRates[index] = params.metabolismRate ?? 0.025;
    this.reproductionThresholds[index] = params.reproductionThreshold ?? 60;
    this.mutationRates[index] = params.mutationRate ?? 0.15;

    this.photosynthesisRates[index] = params.photosynthesisRate ?? 0;
    this.seedDispersionRadii[index] = params.seedDispersionRadius ?? 0;
    this.moistureAffinities[index] = params.moistureAffinity ?? 0;
    this.maxSpeeds[index] = params.maxSpeed ?? 0;
    this.maxForces[index] = params.maxForce ?? 0;
    this.perceptionRadii[index] = params.perceptionRadius ?? 0;
    this.fleeRadii[index] = params.fleeRadius ?? 0;
    this.flockingWeights[index] = params.flockingWeight ?? 0;
    this.packWeights[index] = params.packWeight ?? 0;
    this.decompositionRates[index] = params.decompositionRate ?? 0;

    this.idHashes[index] = params.idHash;
    this.parentIndices[index] = params.parentIndex ?? -1;
    this.bornAtTicks[index] = params.bornAtTick ?? 0;
  }
}

