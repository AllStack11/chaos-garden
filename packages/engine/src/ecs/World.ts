/**
 * Chaos Garden - ECS World Simulation Engine
 *
 * Orchestrates the fixed-timestep simulation loop strictly following
 * the 10-step execution pipeline.
 * Operates with 0 bytes of heap memory allocated per tick.
 */

import {
  type SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
  type PRNG,
  createSeededRandom,
  EntityTypeCode,
  type PopulationSummary,
} from "@chaos-garden/shared";
import { EntityPool } from "./EntityPool.js";
import { ComponentStorage } from "./ComponentStorage.js";
import { SoilGrid } from "../environment/SoilGrid.js";
import { SpatialHashGrid } from "../spatial/SpatialHashGrid.js";
import { SteeringSystem } from "../systems/SteeringSystem.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { MetabolismSystem } from "../systems/MetabolismSystem.js";
import { GeneticsSystem } from "../systems/GeneticsSystem.js";
import { MortalitySystem } from "../systems/MortalitySystem.js";
import { RenderPackingSystem } from "../systems/RenderPackingSystem.js";

export interface WorldOptions {
  seed?: number;
  config?: SimulationConfig;
}

export class World {
  readonly config: SimulationConfig;
  readonly seed: number;
  readonly prng: PRNG;

  readonly pool: EntityPool;
  readonly storage: ComponentStorage;
  readonly soil: SoilGrid;
  readonly spatialGrid: SpatialHashGrid;

  // Subsystems
  readonly steeringSystem: SteeringSystem;
  readonly physicsSystem: PhysicsSystem;
  readonly metabolismSystem: MetabolismSystem;
  readonly geneticsSystem: GeneticsSystem;
  readonly mortalitySystem: MortalitySystem;
  readonly renderPackingSystem: RenderPackingSystem;

  private _tick: number = 0;
  private _lastTickDurationMs: number = 0;

  constructor(options: WorldOptions = {}) {
    this.seed = options.seed ?? 42;
    this.config = options.config ?? DEFAULT_SIMULATION_CONFIG;
    this.prng = createSeededRandom(this.seed);

    const maxEntities = this.config.maxTotalEntities;

    this.pool = new EntityPool(maxEntities);
    this.storage = new ComponentStorage(maxEntities);
    this.soil = new SoilGrid();
    this.spatialGrid = new SpatialHashGrid({
      worldWidth: this.config.gardenWidth,
      worldHeight: this.config.gardenHeight,
      cellSize: 32,
      maxEntities,
    });

    this.steeringSystem = new SteeringSystem();
    this.physicsSystem = new PhysicsSystem(
      this.config.gardenWidth,
      this.config.gardenHeight,
    );
    this.metabolismSystem = new MetabolismSystem(
      this.config.basePhotosynthesisRate,
      0.5,
    );
    this.geneticsSystem = new GeneticsSystem(this.config);
    this.mortalitySystem = new MortalitySystem();
    this.renderPackingSystem = new RenderPackingSystem(maxEntities);
  }

  get tick(): number {
    return this._tick;
  }

  get lastTickDurationMs(): number {
    return this._lastTickDurationMs;
  }

  /**
   * Advances the simulation by exactly one physics tick (nominal dt = 1/60s).
   * Executes subsystems in strict sequential order.
   */
  step(dt: number = 1 / this.config.targetTps): void {
    const startTime = performance.now();

    // 1. Living Soil & Terrain Diffusion
    this.soil.diffuse();

    // 2. Spatial Hash Grid Rebuild
    this.spatialGrid.clear();
    const activeCount = this.pool.denseCount;
    const dense = this.pool.denseEntities;
    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      this.spatialGrid.insert(
        idx,
        this.storage.positionsX[idx],
        this.storage.positionsY[idx],
      );
    }

    // 3 & 4. Sensory Perception & Craig Reynolds Steering
    this.steeringSystem.update(
      this.pool,
      this.storage,
      this.spatialGrid,
      this.prng,
      this.config.gardenWidth,
      this.config.gardenHeight,
    );

    // 5. Physics Integration & Toroidal Boundary Wrap
    this.physicsSystem.update(dt, this.pool, this.storage);

    // 6. Metabolism, Grazing, Predation & Decomposition
    this.metabolismSystem.update(
      dt,
      this.pool,
      this.storage,
      this.spatialGrid,
      this.soil,
    );

    // 7. Reproduction & Genetics
    this.geneticsSystem.update(this._tick, this.pool, this.storage, this.prng);

    // 8. Senescence, Mortality & Nutrient Return
    this.mortalitySystem.update(this.pool, this.storage, this.soil);

    // 9. Render Stride Serialization
    this.renderPackingSystem.pack(this.pool, this.storage);

    this._tick++;
    this._lastTickDurationMs = performance.now() - startTime;
  }

  /**
   * Seeds initial primordial organisms across the 4 kingdoms.
   */
  seedPrimordialEcosystem(): void {
    const prng = this.prng;
    const w = this.config.gardenWidth;
    const h = this.config.gardenHeight;

    const spawnKingdom = (
      type: EntityTypeCode,
      count: number,
      baseSize: number,
      pigmentBase: number,
      speed: number,
      force: number,
      threshold: number,
    ): void => {
      for (let i = 0; i < count; i++) {
        const idx = this.pool.allocate();
        if (idx === -1) break;

        const x = prng() * w;
        const y = prng() * h;
        const angle = prng() * Math.PI * 2;
        const idHash = (Math.floor(prng() * 1000000) + 1) & 0x00ffffff;

        this.storage.initEntity(idx, {
          idHash: idHash === 0 ? 1 : idHash,
          typeCode: type,
          x,
          y,
          vx: Math.cos(angle) * (speed * 0.5),
          vy: Math.sin(angle) * (speed * 0.5),
          rotation: angle,
          size: baseSize + (prng() * 2 - 1) * 2,
          pigment: (pigmentBase + (prng() * 20 - 10) + 360) % 360,
          energy: 60 + prng() * 30,
          health: 100,
          generation: 1,
          parentIndex: -1,
          bornAtTick: 0,
          lifespan: 1200 + Math.floor(prng() * 600),
          metabolismRate:
            this.config.baseEnergyCostPerTick * (0.8 + prng() * 0.4),
          reproductionThreshold: threshold,
          mutationRate: this.config.mutationMagnitude,

          // Kingdom traits
          photosynthesisRate:
            type === EntityTypeCode.PLANT ? 1.0 + prng() * 0.5 : 0,
          seedDispersionRadius:
            type === EntityTypeCode.PLANT ? 40 + prng() * 30 : 0,
          moistureAffinity: 0.5,
          maxSpeed: speed,
          maxForce: force,
          perceptionRadius:
            type === EntityTypeCode.PLANT ? 0 : 50 + prng() * 30,
          fleeRadius: type === EntityTypeCode.HERBIVORE ? 80 + prng() * 30 : 0,
          flockingWeight: type === EntityTypeCode.HERBIVORE ? 0.8 : 0.4,
          packWeight: type === EntityTypeCode.CARNIVORE ? 1.2 : 0,
          decompositionRate: type === EntityTypeCode.FUNGUS ? 1.0 : 0,
        });
      }
    };

    // Primordial seed counts
    spawnKingdom(
      EntityTypeCode.PLANT,
      this.config.initialPlants,
      6.0,
      120, // Green hue
      0,
      0,
      this.config.plantReproductionThreshold,
    );

    spawnKingdom(
      EntityTypeCode.HERBIVORE,
      this.config.initialHerbivores,
      8.0,
      200, // Cyan/Blue hue
      22.0,
      4.0,
      this.config.herbivoreReproductionThreshold,
    );

    spawnKingdom(
      EntityTypeCode.CARNIVORE,
      this.config.initialCarnivores,
      12.0,
      0, // Red hue
      30.0,
      6.0,
      this.config.carnivoreReproductionThreshold,
    );

    spawnKingdom(
      EntityTypeCode.FUNGUS,
      this.config.initialFungi,
      5.0,
      280, // Purple hue
      0,
      0,
      this.config.fungusReproductionThreshold,
    );
  }

  /**
   * Calculates a census summary of the living population.
   */
  getPopulationSummary(): PopulationSummary {
    const activeCount = this.pool.denseCount;
    const dense = this.pool.denseEntities;

    let plants = 0;
    let herbivores = 0;
    let carnivores = 0;
    let fungi = 0;
    let totalBiomass = 0;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      totalBiomass += this.storage.energies[idx];

      switch (this.storage.typeCodes[idx]) {
        case EntityTypeCode.PLANT:
          plants++;
          break;
        case EntityTypeCode.HERBIVORE:
          herbivores++;
          break;
        case EntityTypeCode.CARNIVORE:
          carnivores++;
          break;
        case EntityTypeCode.FUNGUS:
          fungi++;
          break;
      }
    }

    return {
      plants,
      herbivores,
      carnivores,
      fungi,
      deadMatterCount: 0,
      totalLiving: activeCount,
      totalBiomass,
      allTimeBirths: 0,
      allTimeDeaths: 0,
    };
  }

  /**
   * Retrieves the current binary render frame buffer.
   */
  getRenderFrame(): {
    tick: number;
    entityCount: number;
    buffer: Float32Array;
  } {
    return {
      tick: this._tick,
      entityCount: this.pool.denseCount,
      buffer: this.renderPackingSystem.currentBuffer,
    };
  }

  /**
   * Retrieves the current binary render frame buffer and swaps double buffers
   * so the returned buffer can be safely transferred to a Web Worker or rendering thread
   * without interfering with the next simulation tick's packing pass.
   */
  getTransferableRenderFrame(): {
    tick: number;
    entityCount: number;
    buffer: Float32Array;
  } {
    const frame = {
      tick: this._tick,
      entityCount: this.pool.denseCount,
      buffer: this.renderPackingSystem.currentBuffer,
    };
    this.renderPackingSystem.swapBuffers();
    return frame;
  }

  /**
   * Reclaims a transferred render buffer back into the double-buffering pool.
   */
  returnRenderBuffer(buffer: Float32Array): void {
    this.renderPackingSystem.returnBuffer(buffer);
  }
}
