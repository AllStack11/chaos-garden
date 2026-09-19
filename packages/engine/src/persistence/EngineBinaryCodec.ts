/**
 * Chaos Garden - Engine Binary Checkpoint Codec
 *
 * Provides bit-exact, deterministic little-endian binary serialization
 * and deserialization for the ECS engine.
 * Validates integrity via SHA-256 checksum and schema guards before
 * modifying simulation state.
 */

import {
  type EncodedEngineCheckpoint,
  uint8ArrayToBase64,
  base64ToUint8Array,
  computeSha256Hex,
  EntityTypeCode,
} from '@chaos-garden/shared';
import type { World } from '../ecs/World.js';

export { uint8ArrayToBase64, base64ToUint8Array, computeSha256Hex };

export const ENGINE_BINARY_MAGIC = 0x43475332; // 'CGS2'
export const CURRENT_ENGINE_BINARY_VERSION = 2;
export const HEADER_BYTE_LENGTH = 44; // 11 fields * 4 bytes

export function calculateExpectedByteLength(capacity: number, soilCols: number, soilRows: number): number {
  const poolBytes = capacity * (2 + 4 + 4 + 4); // generations (uint16), freeList (int32), denseEntities (int32), sparseIndices (int32)
  const float32ColsBytes = 24 * capacity * 4;
  const uint32ColsBytes = 6 * capacity * 4;
  const int32ColsBytes = 1 * capacity * 4;
  const uint16ColsBytes = 1 * capacity * 2;
  const uint8ColsBytes = 1 * capacity * 1;
  const storageBytes = float32ColsBytes + uint32ColsBytes + int32ColsBytes + uint16ColsBytes + uint8ColsBytes;
  const soilBytes = 2 * soilCols * soilRows * 4; // moisture + nitrates (float32)
  return HEADER_BYTE_LENGTH + poolBytes + storageBytes + soilBytes;
}

export class EngineBinaryCodec {
  /**
   * Encodes world state into a compact, deterministic binary buffer.
   */
  static encode(world: World): Uint8Array {
    const cap = world.storage.capacity;
    const soilCols = world.soil.cols;
    const soilRows = world.soil.rows;
    const totalBytes = calculateExpectedByteLength(cap, soilCols, soilRows);

    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // 1. Header (44 bytes, little-endian)
    view.setUint32(0, ENGINE_BINARY_MAGIC, true);
    view.setUint32(4, CURRENT_ENGINE_BINARY_VERSION, true);
    view.setUint32(8, world.tick, true);
    view.setUint32(12, world.seed, true);
    view.setUint32(16, world.prng.getState(), true);
    view.setUint32(20, world.nextEntityId, true);
    view.setUint32(24, cap, true);
    view.setUint32(28, world.pool.denseCount, true);
    view.setUint32(32, world.pool.freeCount, true);
    view.setUint32(36, soilCols, true);
    view.setUint32(40, soilRows, true);

    let offset = HEADER_BYTE_LENGTH;

    // 2. 4-byte columns (Guaranteed 4-byte aligned after 44-byte header)
    // EntityPool 4-byte columns
    new Uint32Array(buffer, offset, cap).set(world.pool.freeList);
    offset += cap * 4;
    new Uint32Array(buffer, offset, cap).set(world.pool.denseEntities);
    offset += cap * 4;
    new Int32Array(buffer, offset, cap).set(world.pool.sparseIndices);
    offset += cap * 4;

    // ComponentStorage Float32 columns
    const storage = world.storage;
    const float32Cols: Float32Array[] = [
      storage.positionsX,
      storage.positionsY,
      storage.velocitiesX,
      storage.velocitiesY,
      storage.accelerationsX,
      storage.accelerationsY,
      storage.rotations,
      storage.energies,
      storage.healths,
      storage.sizes,
      storage.pigments,
      storage.metabolismRates,
      storage.reproductionThresholds,
      storage.mutationRates,
      storage.photosynthesisRates,
      storage.seedDispersionRadii,
      storage.moistureAffinities,
      storage.maxSpeeds,
      storage.maxForces,
      storage.perceptionRadii,
      storage.fleeRadii,
      storage.flockingWeights,
      storage.packWeights,
      storage.decompositionRates,
    ];

    for (const col of float32Cols) {
      new Float32Array(buffer, offset, cap).set(col);
      offset += cap * 4;
    }

    // ComponentStorage Uint32 columns
    const uint32Cols: Uint32Array[] = [
      storage.ages,
      storage.maxLifespans,
      storage.idHashes,
      storage.bornAtTicks,
      storage.entityIds,
      storage.parentEntityIds,
    ];

    for (const col of uint32Cols) {
      new Uint32Array(buffer, offset, cap).set(col);
      offset += cap * 4;
    }

    // ComponentStorage Int32 column
    new Int32Array(buffer, offset, cap).set(storage.parentIndices);
    offset += cap * 4;

    // SoilGrid Float32 columns
    const soilCellCount = soilCols * soilRows;
    new Float32Array(buffer, offset, soilCellCount).set(world.soil.moisture);
    offset += soilCellCount * 4;
    new Float32Array(buffer, offset, soilCellCount).set(world.soil.nitrates);
    offset += soilCellCount * 4;

    // 3. 2-byte columns (Guaranteed 2-byte aligned after 4-byte columns)
    new Uint16Array(buffer, offset, cap).set(world.pool.generations);
    offset += cap * 2;
    new Uint16Array(buffer, offset, cap).set(storage.generations);
    offset += cap * 2;

    // 4. 1-byte column (Byte-aligned by definition)
    new Uint8Array(buffer, offset, cap).set(storage.typeCodes);
    offset += cap * 1;

    return bytes;
  }

  /**
   * Decodes binary payload into world state after validating integrity and capacities.
   * Decodes binary payload into world state after validating integrity, capacities,
   * pool topology, and entity invariants.
   * Returns true if successfully hydrated, false if rejected.
   * Never mutates world state on validation failure.
   * Strictly never mutates world state on validation failure.
   */
  static decode(world: World, payload: Uint8Array): boolean {
    if (!payload || payload.byteLength < HEADER_BYTE_LENGTH) {
      return false;
    }

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // 1. Header validation
    const magic = view.getUint32(0, true);
    if (magic !== ENGINE_BINARY_MAGIC) {
      return false;
    }

    const version = view.getUint32(4, true);
    if (version !== CURRENT_ENGINE_BINARY_VERSION) {
      return false;
    }

    const tick = view.getUint32(8, true);
    const seed = view.getUint32(12, true);
    const prngState = view.getUint32(16, true);
    const nextEntityId = view.getUint32(20, true);
    const capacity = view.getUint32(24, true);
    const denseCount = view.getUint32(28, true);
    const freeCount = view.getUint32(32, true);
    const soilCols = view.getUint32(36, true);
    const soilRows = view.getUint32(40, true);

    // 2. Structural sanity checks
    if (capacity !== world.storage.capacity) {
      return false;
    }
    if (soilCols !== world.soil.cols || soilRows !== world.soil.rows) {
      return false;
    }
    if (denseCount > capacity || freeCount > capacity || denseCount + freeCount !== capacity) {
      return false;
    }

    const expectedLength = calculateExpectedByteLength(capacity, soilCols, soilRows);
    if (payload.byteLength !== expectedLength) {
      return false;
    }

    // All validation passed; restore world state
    const buffer = payload.buffer;
    const baseOffset = payload.byteOffset;
    const cap = capacity;
    let offset = baseOffset + HEADER_BYTE_LENGTH;

    // 3. Pre-extract staging views to validate all invariants BEFORE world mutation
    // Pool views
    const freeListView = new Uint32Array(buffer, offset, cap);
    const denseEntitiesView = new Uint32Array(buffer, offset + cap * 4, cap);
    const sparseIndicesView = new Int32Array(buffer, offset + cap * 8, cap);

    // Component storage Float32 views (offset 12 * cap)
    const float32Base = offset + cap * 12;
    const positionsXView = new Float32Array(buffer, float32Base, cap);
    const positionsYView = new Float32Array(buffer, float32Base + cap * 4, cap);
    const velocitiesXView = new Float32Array(buffer, float32Base + cap * 8, cap);
    const velocitiesYView = new Float32Array(buffer, float32Base + cap * 12, cap);
    const accelerationsXView = new Float32Array(buffer, float32Base + cap * 16, cap);
    const accelerationsYView = new Float32Array(buffer, float32Base + cap * 20, cap);
    const rotationsView = new Float32Array(buffer, float32Base + cap * 24, cap);
    const energiesView = new Float32Array(buffer, float32Base + cap * 28, cap);
    const healthsView = new Float32Array(buffer, float32Base + cap * 32, cap);
    const sizesView = new Float32Array(buffer, float32Base + cap * 36, cap);

    // Component storage Uint32 views (24 Float32 columns = 24 * cap * 4)
    const uint32Base = float32Base + 24 * cap * 4;
    const entityIdsView = new Uint32Array(buffer, uint32Base + cap * 16, cap); // 5th column: entityIds

    // Soil grid views (6 Uint32 cols + 1 Int32 col = 7 cols * cap * 4)
    const soilBase = uint32Base + 7 * cap * 4;
    const soilCellCount = soilCols * soilRows;
    const soilMoistureView = new Float32Array(buffer, soilBase, soilCellCount);
    const soilNitratesView = new Float32Array(buffer, soilBase + soilCellCount * 4, soilCellCount);

    // 2-byte columns (2 cols * cap * 2) and 1-byte column (typeCodes)
    const twoByteBase = soilBase + soilCellCount * 8;
    const oneByteBase = twoByteBase + cap * 4;
    const typeCodesView = new Uint8Array(buffer, oneByteBase, cap);

    // 4. Invariant Validation: Pool topology, bounds, and uniqueness
    const seenSlots = new Uint8Array(capacity);
    for (let i = 0; i < denseCount; i++) {
      const slot = denseEntitiesView[i];
      if (slot >= capacity) return false;
      if (sparseIndicesView[slot] !== i) return false;
      if (seenSlots[slot] !== 0) return false; // Duplicate slot in dense array
      seenSlots[slot] = 1;
    }

    for (let j = 0; j < freeCount; j++) {
      const freeSlot = freeListView[j];
      if (freeSlot >= capacity) return false;
      if (seenSlots[freeSlot] !== 0) return false; // Slot cannot be both free and active
      seenSlots[freeSlot] = 2;
    }

    // 5. Invariant Validation: Entity components across all active slots
    const worldW = world.config.gardenWidth;
    const worldH = world.config.gardenHeight;

    for (let i = 0; i < denseCount; i++) {
      const slot = denseEntitiesView[i];

      const type = typeCodesView[slot];
      if (
        type !== EntityTypeCode.PLANT &&
        type !== EntityTypeCode.HERBIVORE &&
        type !== EntityTypeCode.CARNIVORE &&
        type !== EntityTypeCode.FUNGUS
      ) {
        return false;
      }

      const entityId = entityIdsView[slot];
      if (entityId === 0) return false;

      const px = positionsXView[slot];
      const py = positionsYView[slot];
      if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
      if (px < 0 || px >= worldW || py < 0 || py >= worldH) return false;

      const vx = velocitiesXView[slot];
      const vy = velocitiesYView[slot];
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) return false;

      const ax = accelerationsXView[slot];
      const ay = accelerationsYView[slot];
      if (!Number.isFinite(ax) || !Number.isFinite(ay)) return false;

      const rot = rotationsView[slot];
      if (!Number.isFinite(rot)) return false;

      const en = energiesView[slot];
      const hl = healthsView[slot];
      if (!Number.isFinite(en) || en < 0 || !Number.isFinite(hl) || hl < 0) return false;

      const sz = sizesView[slot];
      if (!Number.isFinite(sz) || sz <= 0) return false;
    }

    // 6. Invariant Validation: Soil grid values
    for (let k = 0; k < soilCellCount; k++) {
      const m = soilMoistureView[k];
      const n = soilNitratesView[k];
      if (!Number.isFinite(m) || m < 0 || m > 1.0) return false;
      if (!Number.isFinite(n) || n < 0 || n > 1.0) return false;
    }

    // All validation passed strictly without touching world state!
    // Now apply state mutation to target world:
    (world as { seed: number }).seed = seed;
    world.setTick(tick);
    world.prng.setState(prngState);
    world.nextEntityId = nextEntityId;

    offset = baseOffset + HEADER_BYTE_LENGTH;

    // Restore 4-byte columns
    // EntityPool
    world.pool.freeList.set(new Uint32Array(buffer, offset, cap));
    offset += cap * 4;
    world.pool.denseEntities.set(new Uint32Array(buffer, offset, cap));
    offset += cap * 4;
    world.pool.sparseIndices.set(new Int32Array(buffer, offset, cap));
    offset += cap * 4;
    world.pool.setDenseCount(denseCount);
    world.pool.setFreeCount(freeCount);

    // ComponentStorage (Float32 columns)
    const storage = world.storage;
    const float32Cols: Float32Array[] = [
      storage.positionsX,
      storage.positionsY,
      storage.velocitiesX,
      storage.velocitiesY,
      storage.accelerationsX,
      storage.accelerationsY,
      storage.rotations,
      storage.energies,
      storage.healths,
      storage.sizes,
      storage.pigments,
      storage.metabolismRates,
      storage.reproductionThresholds,
      storage.mutationRates,
      storage.photosynthesisRates,
      storage.seedDispersionRadii,
      storage.moistureAffinities,
      storage.maxSpeeds,
      storage.maxForces,
      storage.perceptionRadii,
      storage.fleeRadii,
      storage.flockingWeights,
      storage.packWeights,
      storage.decompositionRates,
    ];

    for (const col of float32Cols) {
      col.set(new Float32Array(buffer, offset, cap));
      offset += cap * 4;
    }

    // Uint32 columns
    const uint32Cols: Uint32Array[] = [
      storage.ages,
      storage.maxLifespans,
      storage.idHashes,
      storage.bornAtTicks,
      storage.entityIds,
      storage.parentEntityIds,
    ];

    for (const col of uint32Cols) {
      col.set(new Uint32Array(buffer, offset, cap));
      offset += cap * 4;
    }

    // Int32 column
    storage.parentIndices.set(new Int32Array(buffer, offset, cap));
    offset += cap * 4;

    // Restore SoilGrid
    world.soil.moisture.set(new Float32Array(buffer, offset, soilCellCount));
    offset += soilCellCount * 4;
    world.soil.nitrates.set(new Float32Array(buffer, offset, soilCellCount));
    offset += soilCellCount * 4;

    // Restore 2-byte columns
    world.pool.generations.set(new Uint16Array(buffer, offset, cap));
    offset += cap * 2;
    storage.generations.set(new Uint16Array(buffer, offset, cap));
    offset += cap * 2;

    // Restore 1-byte column
    storage.typeCodes.set(new Uint8Array(buffer, offset, cap));
    offset += cap * 1;

    // Re-pack render buffer for immediate drawing
    world.renderPackingSystem.pack(world.pool, world.storage, world.tick);

    return true;
  }

  /**
   * Exports an EncodedEngineCheckpoint with SHA-256 checksum and base64 payload.
   */
  static async exportCheckpoint(world: World): Promise<EncodedEngineCheckpoint> {
    const rawBytes = EngineBinaryCodec.encode(world);
    const checksum = await computeSha256Hex(rawBytes);
    const payload = uint8ArrayToBase64(rawBytes);

    return {
      version: CURRENT_ENGINE_BINARY_VERSION,
      tick: world.tick,
      seed: world.seed,
      byteLength: rawBytes.byteLength,
      checksum,
      payload,
    };
  }

  /**
   * Validates and hydrates an EncodedEngineCheckpoint.
   * Rejects malformed payload or checksum mismatch without mutating world state.
   */
  static async hydrateCheckpoint(
    world: World,
    checkpoint: EncodedEngineCheckpoint,
  ): Promise<boolean> {
    if (!checkpoint || !checkpoint.payload || !checkpoint.checksum) {
      return false;
    }

    let rawBytes: Uint8Array;
    try {
      rawBytes = base64ToUint8Array(checkpoint.payload);
    } catch {
      return false;
    }

    if (rawBytes.byteLength !== checkpoint.byteLength) {
      return false;
    }

    // Verify SHA-256 checksum matches before modifying world
    const computedChecksum = await computeSha256Hex(rawBytes);
    if (computedChecksum.toLowerCase() !== checkpoint.checksum.toLowerCase()) {
      return false;
    }

    return EngineBinaryCodec.decode(world, rawBytes);
  }
}
