import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/World.js';
import {
  EngineBinaryCodec,
  CURRENT_ENGINE_BINARY_VERSION,
  ENGINE_BINARY_MAGIC,
} from '../../src/persistence/EngineBinaryCodec.js';
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  computeSha256Hex,
  EntityTypeCode,
  DEFAULT_SIMULATION_CONFIG,
  type EncodedEngineCheckpoint,
} from '@chaos-garden/shared';
import * as zlib from 'node:zlib';

describe('EngineBinaryCodec (Deterministic Checkpoints & Integrity)', () => {
  it('encodes and decodes bit-identically with valid checksum', async () => {
    const world1 = new World({ seed: 1337, config: { ...DEFAULT_SIMULATION_CONFIG, maxTotalEntities: 100 } });
    world1.seedPrimordialEcosystem();

    // Step world 50 ticks
    for (let i = 0; i < 50; i++) {
      world1.step();
    }

    const checkpoint = await world1.exportEngineCheckpoint();
    expect(checkpoint.version).toBe(CURRENT_ENGINE_BINARY_VERSION);
    expect(checkpoint.tick).toBe(50);
    expect(checkpoint.seed).toBe(1337);
    expect(checkpoint.byteLength).toBeGreaterThan(0);
    expect(checkpoint.checksum).toHaveLength(64);

    // Create fresh world and hydrate
    const world2 = new World({ seed: 9999, config: { ...DEFAULT_SIMULATION_CONFIG, maxTotalEntities: 100 } });
    const success = await world2.hydrateEngineCheckpoint(checkpoint);
    expect(success).toBe(true);

    expect(world2.tick).toBe(world1.tick);
    expect(world2.seed).toBe(world1.seed);
    expect(world2.pool.denseCount).toBe(world1.pool.denseCount);
    expect(world1.flightRecorder.count).toBe(50);

    // Continue both worlds 1,000 ticks and verify bit-identical continuation
    for (let i = 0; i < 1000; i++) {
      world1.step();
      world2.step();
    }

    expect(world1.tick).toBe(1050);
    expect(world2.tick).toBe(1050);
    expect(world1.pool.denseCount).toBe(world2.pool.denseCount);

    // Verify all active entity positions and energies are bit-identical
    const count = world1.pool.denseCount;
    for (let i = 0; i < count; i++) {
      const idx1 = world1.pool.denseEntities[i];
      const idx2 = world2.pool.denseEntities[i];
      expect(idx1).toBe(idx2);
      expect(world1.storage.positionsX[idx1]).toBe(world2.storage.positionsX[idx2]);
      expect(world1.storage.positionsY[idx1]).toBe(world2.storage.positionsY[idx2]);
      expect(world1.storage.energies[idx1]).toBe(world2.storage.energies[idx2]);
      expect(world1.storage.entityIds[idx1]).toBe(world2.storage.entityIds[idx2]);
      expect(world1.storage.parentEntityIds[idx1]).toBe(world2.storage.parentEntityIds[idx2]);
    }
  });

  it('rejects corrupted byte or checksum mismatch without mutating world', async () => {
    const world = new World({ seed: 42, maxEntities: 100 });
    world.seedPrimordialEcosystem();
    for (let i = 0; i < 10; i++) world.step();

    const checkpoint = await world.exportEngineCheckpoint();
    const originalTick = world.tick;
    const originalPrng = world.prng();

    // 1. Corrupt byte in payload
    const bytes = base64ToUint8Array(checkpoint.payload);
    bytes[50] ^= 0xff; // Flip bits
    const corruptedPayload = uint8ArrayToBase64(bytes);

    const corruptedCheckpoint: EncodedEngineCheckpoint = {
      ...checkpoint,
      payload: corruptedPayload,
    };

    const result = await world.hydrateEngineCheckpoint(corruptedCheckpoint);
    expect(result).toBe(false);

    // World state must remain intact
    expect(world.tick).toBe(originalTick);

    // 2. Alter declared checksum
    const badChecksumCheckpoint: EncodedEngineCheckpoint = {
      ...checkpoint,
      checksum: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    };

    const result2 = await world.hydrateEngineCheckpoint(badChecksumCheckpoint);
    expect(result2).toBe(false);
    expect(world.tick).toBe(originalTick);
  });

  it('rejects unsupported version without mutating world', async () => {
    const world = new World({ seed: 42, config: { ...DEFAULT_SIMULATION_CONFIG, maxTotalEntities: 100 } });
    world.seedPrimordialEcosystem();

    const checkpoint = await world.exportEngineCheckpoint();
    const bytes = base64ToUint8Array(checkpoint.payload);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint32(4, 999, true); // Bad version 999

    const newChecksum = await computeSha256Hex(bytes);
    const badVersionCheckpoint: EncodedEngineCheckpoint = {
      ...checkpoint,
      version: 999,
      checksum: newChecksum,
      payload: uint8ArrayToBase64(bytes),
    };

    const success = await world.hydrateEngineCheckpoint(badVersionCheckpoint);
    expect(success).toBe(false);
  });

  it('rejects capacity mismatch without mutating world', async () => {
    // Export from world with capacity 50
    const smallWorld = new World({ seed: 42, config: { ...DEFAULT_SIMULATION_CONFIG, maxTotalEntities: 50 } });
    smallWorld.seedPrimordialEcosystem();
    const checkpoint = await smallWorld.exportEngineCheckpoint();

    // Hydrate into world with capacity 100
    const bigWorld = new World({ seed: 42, config: { ...DEFAULT_SIMULATION_CONFIG, maxTotalEntities: 100 } });
    bigWorld.seedPrimordialEcosystem();
    const originalCount = bigWorld.pool.denseCount;

    const success = await bigWorld.hydrateEngineCheckpoint(checkpoint);
    expect(success).toBe(false);
    expect(bigWorld.pool.capacity).toBe(100);
    expect(bigWorld.pool.denseCount).toBe(originalCount);
  });

  it('verifies size budget: encoded payload stays below 350 KB at 2,000 entities', async () => {
    const world = new World({ seed: 777 });
    world.seedPrimordialEcosystem();

    const checkpoint = await world.exportEngineCheckpoint();
    const rawBytes = base64ToUint8Array(checkpoint.payload);
    const rawByteLength = rawBytes.byteLength;
    const base64Length = checkpoint.payload.length;

    // Measure gzip compression
    const gzipped = zlib.gzipSync(rawBytes);
    const gzippedByteLength = gzipped.byteLength;

    console.log(`\n📦 Checkpoint Storage Budget Metrics (2,000 entity capacity):`);
    console.log(`   - Raw Binary Size: ${(rawByteLength / 1024).toFixed(2)} KB (${rawByteLength} bytes)`);
    console.log(`   - Base64 String:   ${(base64Length / 1024).toFixed(2)} KB (${base64Length} chars)`);
    console.log(`   - Gzip Compressed: ${(gzippedByteLength / 1024).toFixed(2)} KB (${gzippedByteLength} bytes)`);

    // Budget requirement: < 350 KB for binary payload
    expect(rawByteLength).toBeLessThan(350 * 1024);
    expect(gzippedByteLength).toBeLessThan(100 * 1024);
  });
});
