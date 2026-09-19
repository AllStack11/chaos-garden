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
  type EngineSnapshot,
  type EncodedEngineCheckpoint,
  type TransferableRenderFrame,
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
import { FlightRecorder } from "../diagnostics/FlightRecorder.js";
import { EngineBinaryCodec, base64ToUint8Array } from "../persistence/EngineBinaryCodec.js";

export interface WorldOptions {
  seed?: number;
  config?: SimulationConfig;
  prngState?: number;
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
  readonly flightRecorder: FlightRecorder;

  private _tick: number = 0;
  private _lastTickDurationMs: number = 0;
  private _nextEntityId: number = 1;

  constructor(options: WorldOptions = {}) {
    this.seed = options.seed ?? 42;
    this.config = options.config ?? DEFAULT_SIMULATION_CONFIG;
    this.prng = createSeededRandom(this.seed, options.prngState);

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
    this.flightRecorder = new FlightRecorder(300);
  }

  get tick(): number {
    return this._tick;
  }

  setTick(tick: number): void {
    this._tick = tick;
  }

  get nextEntityId(): number {
    return this._nextEntityId;
  }

  set nextEntityId(id: number) {
    this._nextEntityId = id;
  }

  get lastTickDurationMs(): number {
    return this._lastTickDurationMs;
  }

  private rebuildSpatialGrid(): void {
    this.spatialGrid.rebuild(
      this.pool.denseCount,
      this.pool.denseEntities,
      this.storage.positionsX,
      this.storage.positionsY,
    );
  }

  /**
   * Advances the simulation by exactly one physics tick (nominal dt = 1/60s).
   * Executes subsystems in strict sequential order.
   * Executes the 10-step pipeline in strict sequential order.
   * Runs with 0 bytes heap allocations in steady state.
   */
  step(dt: number = 1 / this.config.targetTps): void {
    const startTime = performance.now();

    // 1. Living Soil & Terrain Diffusion
    this.soil.diffuse();

    // 2. Spatial Hash Grid Rebuild (Pre-Steering)
    this.rebuildSpatialGrid();

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

    // 5b. Spatial Hash Grid Rebuild (Post-Physics, Pre-Metabolism)
    this.rebuildSpatialGrid();

    // 6. Metabolism, Grazing, Predation & Decomposition (Exact toroidal nearest target)
    this.metabolismSystem.update(
      dt,
      this.pool,
      this.storage,
      this.spatialGrid,
      this.soil,
    );

    // 7. Reproduction & Genetics (Monotonic immutable durable IDs)
    this.geneticsSystem.update(
      this._tick,
      this.pool,
      this.storage,
      this.prng,
      () => this._nextEntityId++,
    );

    // 8. Senescence, Mortality & Nutrient Return
    this.mortalitySystem.update(this.pool, this.storage, this.soil);

    this._tick++;
    this._lastTickDurationMs = performance.now() - startTime;

    // 9. Render Stride Serialization
    this.renderPackingSystem.pack(this.pool, this.storage, this._tick);

    // 10. Flight Recorder Write (Zero-allocation scalar census write)
    let plants = 0;
    let herbivores = 0;
    let carnivores = 0;
    let fungi = 0;
    let totalBiomass = 0;
    const activeCount = this.pool.denseCount;
    const dense = this.pool.denseEntities;
    const types = this.storage.typeCodes;
    const energies = this.storage.energies;

    for (let i = 0; i < activeCount; i++) {
      const idx = dense[i];
      totalBiomass += energies[idx];
      const t = types[idx];
      if (t === EntityTypeCode.PLANT) plants++;
      else if (t === EntityTypeCode.HERBIVORE) herbivores++;
      else if (t === EntityTypeCode.CARNIVORE) carnivores++;
      else fungi++;
    }

    this.flightRecorder.recordTickDirect(
      this._tick,
      this._lastTickDurationMs,
      plants,
      herbivores,
      carnivores,
      fungi,
      totalBiomass,
    );
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
        const entityId = this._nextEntityId++;

        this.storage.initEntity(idx, {
          idHash: idHash === 0 ? 1 : idHash,
          entityId,
          parentEntityId: 0,
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
   * Retrieves the current transferable render frame buffer and marks it inFlight.
   * Returns null if no frame buffer was available in the fixed pool.
   * Never allocates.
   */
  getTransferableRenderFrame(): TransferableRenderFrame | null {
    return this.renderPackingSystem.getTransferableRenderFrame();
  }

  /**
   * Reclaims a transferred render buffer back into the fixed pool.
   * Returns true if successfully admitted, false if rejected.
   */
  returnRenderBuffer(buffer: Float32Array): boolean {
    return this.renderPackingSystem.returnRenderBuffer(buffer);
  }

  /**
   * Exports an EncodedEngineCheckpoint with SHA-256 integrity hash.
   */
  async exportEngineCheckpoint(): Promise<EncodedEngineCheckpoint> {
    return EngineBinaryCodec.exportCheckpoint(this);
  }

  /**
   * Hydrates state directly from an EncodedEngineCheckpoint with SHA-256 verification.
   */
  async hydrateEngineCheckpoint(checkpoint: EncodedEngineCheckpoint): Promise<boolean> {
    return EngineBinaryCodec.hydrateCheckpoint(this, checkpoint);
  }

  /**
   * Serializes current simulation state into a CanonicalWorldState snapshot,
   * embedding a versioned EngineSnapshot with bit-exact component columns,
   * stable parent lineage IDs, pool state, and PRNG state.
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
      const entityId = storage.entityIds[idx] || idHash;

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
            fleePerceptionRadius: storage.fleeRadii[idx],
            flockingWeight: storage.flockingWeights[idx],
          };
          break;
        case EntityTypeCode.CARNIVORE:
          genome = {
            type: "carnivore",
            ...baseGenome,
            maxSpeed: storage.maxSpeeds[idx],
            maxForce: storage.maxForces[idx],
            huntPerceptionRadius: storage.perceptionRadii[idx],
            packWeight: storage.packWeights[idx],
            ambushPatience: 100,
          };
          break;
        case EntityTypeCode.FUNGUS:
          genome = {
            type: "fungus",
            ...baseGenome,
            decompositionRate: storage.decompositionRates[idx],
            sporeDispersionRadius: storage.seedDispersionRadii[idx] || 40,
            myceliumSpreadRate: 1.0,
          };
          break;
      }

      const parentSlot = storage.parentIndices[idx];
      const parentEntityId = storage.parentEntityIds[idx];
      const parentId =
        parentEntityId && parentEntityId !== 0
          ? parentEntityId.toString()
          : parentSlot >= 0 && storage.idHashes[parentSlot] !== 0
            ? storage.idHashes[parentSlot].toString()
            : "origin";

      entities.push({
        id: entityId.toString(),
        type: typeStr,
        name: `${typeStr} #${idHash}`,
        species: typeStr,
        position: { x: storage.positionsX[idx], y: storage.positionsY[idx] },
        velocity: { x: storage.velocitiesX[idx], y: storage.velocitiesY[idx] },
        rotation: storage.rotations[idx],
        energy: storage.energies[idx],
        health: storage.healths[idx],
        age: storage.ages[idx],
        generation: storage.generations[idx],
        parentId,
        bornAtTick: storage.bornAtTicks[idx],
        isAlive: true,
        genome,
      });
    }

    const sunlight = 0.5 + 0.5 * Math.sin((this._tick / 1200) * Math.PI * 2);

    const soilState = {
      cols: this.soil.cols,
      rows: this.soil.rows,
      cellSize: this.soil.cellSize,
      moisture: Array.from(this.soil.moisture),
      nitrates: Array.from(this.soil.nitrates),
    };

    const prngState = this.prng.getState();

    const engineSnapshot: EngineSnapshot = {
      version: 1,
      tick: this._tick,
      seed: this.seed,
      prngState,
      pool: this.pool.exportState(),
      storage: this.storage.exportState(),
      soil: soilState,
    };

    return {
      id: 1,
      version: 1,
      tick: this._tick,
      epoch: Math.floor(this._tick / 10000) + 1,
      timestamp: new Date().toISOString(),
      seed: this.seed,
      prngState,
      atmospheric: {
        ...DEFAULT_ATMOSPHERIC_STATE,
        sunlight,
      },
      populationSummary: this.getPopulationSummary(),
      entities,
      deadMatter: [],
      soil: soilState,
      checksum: `snap-${this._tick}-${activeCount}`,
      engineSnapshot,
    };
  }

  /**
   * Losslessly hydrates simulation state from a CanonicalWorldState, EngineSnapshot, or EncodedEngineCheckpoint.
   */
  hydrateCanonicalState(state: CanonicalWorldState | EngineSnapshot | EncodedEngineCheckpoint): boolean {
    if (!state) return false;

    // 1. Primary path: Restore bit-exact EngineSnapshot
    // 0. Binary encoded checkpoint path
    if ("checkpoint" in state && state.checkpoint) {
      try {
        const rawBytes = base64ToUint8Array(state.checkpoint.payload);
        const ok = EngineBinaryCodec.decode(this, rawBytes);
        if (ok) return true;
      } catch {
        // fall through to other representations
      }
    }

    if ("payload" in state && typeof state.payload === "string" && "checksum" in state) {
      try {
        const rawBytes = base64ToUint8Array(state.payload);
        const ok = EngineBinaryCodec.decode(this, rawBytes);
        if (ok) return true;
      } catch {
        // fall through
      }
    }

    // 1. Primary legacy path: Restore bit-exact EngineSnapshot
    const engineSnapshot: EngineSnapshot | null =
      "engineSnapshot" in state && state.engineSnapshot
        ? state.engineSnapshot
        : "pool" in state && "storage" in state
          ? (state as EngineSnapshot)
          : null;

    if (engineSnapshot && engineSnapshot.pool && engineSnapshot.storage) {
      this._tick = engineSnapshot.tick;
      if (typeof engineSnapshot.prngState === "number") {
        this.prng.setState(engineSnapshot.prngState);
      }
      this.pool.loadState(engineSnapshot.pool);
      this.storage.loadState(engineSnapshot.storage);
      if (engineSnapshot.soil) {
        this.soil.loadState(engineSnapshot.soil.moisture, engineSnapshot.soil.nitrates);
      }
      this.renderPackingSystem.pack(this.pool, this.storage);

      // Recompute nextEntityId safely
      let maxId = 0;
      for (let i = 0; i < this.storage.capacity; i++) {
        if (this.storage.entityIds[i] > maxId) maxId = this.storage.entityIds[i];
      }
      this._nextEntityId = Math.max(this._nextEntityId, maxId + 1);

      this.renderPackingSystem.pack(this.pool, this.storage, this._tick);
      return true;
    }

    // 2. Fallback path: Hydrate from high-level CanonicalWorldState entities
    const canonical = state as CanonicalWorldState;
    if (
      typeof canonical.tick !== "number" ||
      !Array.isArray(canonical.entities) ||
      !canonical.soil ||
      !canonical.soil.moisture ||
      !canonical.soil.nitrates
    ) {
      return false;
    }

    this._tick = canonical.tick;
    if (typeof canonical.prngState === "number") {
      this.prng.setState(canonical.prngState);
    }
    this.pool.reset();
    this.storage.clearAll();

    // Restore living soil fields
    this.soil.loadState(canonical.soil.moisture, canonical.soil.nitrates);

    // Map entity id string to allocated slot index to restore lineage links accurately
    // Map entity id string to allocated slot index and entityId
    const idToSlot = new Map<string, number>();

    // First pass: allocate slots and record id mappings
    for (const ent of canonical.entities) {
      const idx = this.pool.allocate();
      if (idx === -1) break;
      idToSlot.set(ent.id, idx);

      const typeCode = getEntityTypeCode(ent.type);
      const parsedId = parseInt(ent.id, 10);
      const entityId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : this._nextEntityId++;
      const idHash = (entityId || Math.floor(this.prng() * 1000000) + 1) & 0x00ffffff;
      const g = ent.genome;

      const rot =
        typeof ent.rotation === "number"
          ? ent.rotation
          : Math.atan2(ent.velocity.y, ent.velocity.x);

      this.storage.initEntity(idx, {
        idHash: idHash === 0 ? 1 : idHash,
        entityId,
        parentEntityId: 0, // will be resolved in second pass
        typeCode,
        x: ent.position.x,
        y: ent.position.y,
        vx: ent.velocity.x,
        vy: ent.velocity.y,
        rotation: rot,
        size: g.size ?? 8,
        pigment: g.pigment ?? 120,
        energy: ent.energy,
        health: ent.health,
        generation: ent.generation ?? 1,
        parentIndex: -1, // will be resolved in second pass
        bornAtTick: ent.bornAtTick ?? 0,
        lifespan: g.lifespan ?? 1500,
        metabolismRate:
          g.metabolismEfficiency ?? this.config.baseEnergyCostPerTick,
        reproductionThreshold: g.reproductionThreshold ?? 60,
        mutationRate: g.mutationRate ?? this.config.mutationMagnitude,
        photosynthesisRate:
          "photosynthesisRate" in g ? (g as any).photosynthesisRate : 0,
        seedDispersionRadius:
          "seedDispersionRadius" in g
            ? (g as any).seedDispersionRadius
            : "sporeDispersionRadius" in g
              ? (g as any).sporeDispersionRadius
              : 0,
        moistureAffinity:
          "moistureAffinity" in g ? (g as any).moistureAffinity : 0.5,
        maxSpeed: "maxSpeed" in g ? (g as any).maxSpeed : 0,
        maxForce: "maxForce" in g ? (g as any).maxForce : 0,
        perceptionRadius:
          "huntPerceptionRadius" in g
            ? (g as any).huntPerceptionRadius
            : "perceptionRadius" in g
              ? (g as any).perceptionRadius
              : 0,
        fleeRadius:
          "fleePerceptionRadius" in g
            ? (g as any).fleePerceptionRadius
            : (g as any).fleeRadius ?? (typeCode === EntityTypeCode.HERBIVORE ? 80 : 0),
        flockingWeight:
          "flockingWeight" in g
            ? (g as any).flockingWeight
            : typeCode === EntityTypeCode.HERBIVORE ? 0.8 : 0.4,
        packWeight:
          "packWeight" in g
            ? (g as any).packWeight
            : typeCode === EntityTypeCode.CARNIVORE ? 1.2 : 0,
        decompositionRate:
          "decompositionRate" in g ? (g as any).decompositionRate : 0,
      });
    }

    // Second pass: wire stable lineage parentIndex
    // Second pass: wire stable lineage parentEntityId
    for (const ent of canonical.entities) {
      const childSlot = idToSlot.get(ent.id);
      if (childSlot !== undefined && ent.parentId && ent.parentId !== "origin") {
        const parentIdNum = parseInt(ent.parentId, 10);
        if (Number.isFinite(parentIdNum)) {
          this.storage.parentEntityIds[childSlot] = parentIdNum;
        }
        const parentSlot = idToSlot.get(ent.parentId);
        if (parentSlot !== undefined) {
          this.storage.parentIndices[childSlot] = parentSlot;
        }
      }
    }

    // Re-pack render buffer for immediate drawing
    this.renderPackingSystem.pack(this.pool, this.storage);
    this.renderPackingSystem.pack(this.pool, this.storage, this._tick);
    return true;
  }
}
