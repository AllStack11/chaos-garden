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
  type CanonicalWorldState,
  type Entity,
  getEntityTypeCode,
  getEntityTypeFromCode,
  DEFAULT_ATMOSPHERIC_STATE,
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

  /**
   * Serializes current simulation state into a CanonicalWorldState snapshot.
   */
  exportCanonicalState(): CanonicalWorldState {
    const activeCount = this.pool.denseCount;
    const dense = this.pool.denseEntities;
    const storage = this.storage;
    const entities: Entity[] = [];

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      const typeCode = storage.typeCodes[idx] as EntityTypeCode;
      const typeStr = getEntityTypeFromCode(typeCode);
      const idHash = storage.idHashes[idx];

      const baseGenome = {
        metabolismEfficiency: storage.metabolismRates[idx],
        reproductionThreshold: storage.reproductionThresholds[idx],
        mutationRate: storage.mutationRates[idx],
        size: storage.sizes[idx],
        lifespan: storage.maxLifespans[idx],
        pigment: storage.pigments[idx],
      };

      let genome: any;
      switch (typeCode) {
        case EntityTypeCode.PLANT:
          genome = {
            type: "plant",
            ...baseGenome,
            photosynthesisRate: storage.photosynthesisRates[idx],
            seedDispersionRadius: storage.seedDispersionRadii[idx],
            moistureAffinity: storage.moistureAffinities[idx],
          };
          break;
        case EntityTypeCode.HERBIVORE:
          genome = {
            type: "herbivore",
            ...baseGenome,
            maxSpeed: storage.maxSpeeds[idx],
            maxForce: storage.maxForces[idx],
            perceptionRadius: storage.perceptionRadii[idx],
            fleeRadius: storage.fleeRadii[idx],
            flockingWeight: storage.flockingWeights[idx],
          };
          break;
        case EntityTypeCode.CARNIVORE:
          genome = {
            type: "carnivore",
            ...baseGenome,
            maxSpeed: storage.maxSpeeds[idx],
            maxForce: storage.maxForces[idx],
            perceptionRadius: storage.perceptionRadii[idx],
            packWeight: storage.packWeights[idx],
          };
          break;
        case EntityTypeCode.FUNGUS:
          genome = {
            type: "fungus",
            ...baseGenome,
            decompositionRate: storage.decompositionRates[idx],
            sporeDispersionRadius: 40,
            myceliumSpreadRate: 1.0,
          };
          break;
      }

      entities.push({
        id: idHash.toString(),
        type: typeStr,
        name: `${typeStr} #${idHash}`,
        species: typeStr,
        position: { x: storage.positionsX[idx], y: storage.positionsY[idx] },
        velocity: { x: storage.velocitiesX[idx], y: storage.velocitiesY[idx] },
        energy: storage.energies[idx],
        health: storage.healths[idx],
        age: storage.ages[idx],
        generation: storage.generations[idx],
        parentId:
          storage.parentIndices[idx] === -1
            ? "origin"
            : storage.parentIndices[idx].toString(),
        bornAtTick: storage.bornAtTicks[idx],
        isAlive: true,
        genome,
      });
    }

    const sunlight = 0.5 + 0.5 * Math.sin((this._tick / 1200) * Math.PI * 2);

    return {
      id: 1,
      tick: this._tick,
      epoch: Math.floor(this._tick / 10000) + 1,
      timestamp: new Date().toISOString(),
      seed: this.seed,
      atmospheric: {
        ...DEFAULT_ATMOSPHERIC_STATE,
        sunlight,
      },
      populationSummary: this.getPopulationSummary(),
      entities,
      deadMatter: [],
      soil: {
        cols: this.soil.cols,
        rows: this.soil.rows,
        cellSize: this.soil.cellSize,
        moisture: Array.from(this.soil.moisture),
        nitrates: Array.from(this.soil.nitrates),
      },
      checksum: `snap-${this._tick}-${activeCount}`,
    };
  }

  /**
   * Losslessly hydrates simulation state from a CanonicalWorldState snapshot.
   */
  hydrateCanonicalState(state: CanonicalWorldState): boolean {
    if (
      !state ||
      typeof state.tick !== "number" ||
      !Array.isArray(state.entities) ||
      !state.soil ||
      !state.soil.moisture ||
      !state.soil.nitrates
    ) {
      return false;
    }

    this._tick = state.tick;
    this.pool.reset();

    // Restore living soil fields
    this.soil.loadState(state.soil.moisture, state.soil.nitrates);

    // Restore entities
    for (const ent of state.entities) {
      const idx = this.pool.allocate();
      if (idx === -1) break;

      const typeCode = getEntityTypeCode(ent.type);
      const idHash =
        (parseInt(ent.id, 10) || Math.floor(this.prng() * 1000000) + 1) &
        0x00ffffff;
      const g = ent.genome;

      this.storage.initEntity(idx, {
        idHash: idHash === 0 ? 1 : idHash,
        typeCode,
        x: ent.position.x,
        y: ent.position.y,
        vx: ent.velocity.x,
        vy: ent.velocity.y,
        rotation: Math.atan2(ent.velocity.y, ent.velocity.x),
        size: g.size ?? 8,
        pigment: g.pigment ?? 120,
        energy: ent.energy,
        health: ent.health,
        generation: ent.generation ?? 1,
        parentIndex:
          ent.parentId === "origin" ? -1 : parseInt(ent.parentId, 10) || -1,
        bornAtTick: ent.bornAtTick ?? 0,
        lifespan: g.lifespan ?? 1500,
        metabolismRate:
          g.metabolismEfficiency ?? this.config.baseEnergyCostPerTick,
        reproductionThreshold: g.reproductionThreshold ?? 60,
        mutationRate: g.mutationRate ?? this.config.mutationMagnitude,
        photosynthesisRate:
          "photosynthesisRate" in g ? (g as any).photosynthesisRate : 0,
        seedDispersionRadius:
          "seedDispersionRadius" in g ? (g as any).seedDispersionRadius : 0,
        moistureAffinity:
          "moistureAffinity" in g ? (g as any).moistureAffinity : 0.5,
        maxSpeed: "maxSpeed" in g ? (g as any).maxSpeed : 0,
        maxForce: "maxForce" in g ? (g as any).maxForce : 0,
        perceptionRadius:
          "perceptionRadius" in g ? (g as any).perceptionRadius : 0,
        fleeRadius: typeCode === EntityTypeCode.HERBIVORE ? 80 : 0,
        flockingWeight: typeCode === EntityTypeCode.HERBIVORE ? 0.8 : 0.4,
        packWeight: typeCode === EntityTypeCode.CARNIVORE ? 1.2 : 0,
        decompositionRate:
          "decompositionRate" in g ? (g as any).decompositionRate : 0,
      });
    }

    // Re-pack render buffer for immediate drawing
    this.renderPackingSystem.pack(this.pool, this.storage);
    return true;
  }
}
