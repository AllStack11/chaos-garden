import { describe, it, expect } from 'vitest';
import { RenderPackingSystem } from '../../src/systems/RenderPackingSystem.js';
import { EntityPool } from '../../src/ecs/EntityPool.js';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { EntityTypeCode, STRIDE_FLOAT_COUNT, unpackStrideToEntity } from '@chaos-garden/shared';

describe('RenderPackingSystem (Zero-Allocation Stride Packing)', () => {
  it('serializes active entities into flat Float32Array stride buffer', () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const packing = new RenderPackingSystem(10);

    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 777,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 150.5,
      y: 250.25,
      rotation: 1.2,
      size: 9.0,
      pigment: 180,
      energy: 80,
      health: 90,
    });

    const packedCount = packing.pack(pool, storage);
    expect(packedCount).toBe(1);

    const unpacked = unpackStrideToEntity(packing.currentBuffer, 0);
    expect(unpacked.idHash).toBe(777);
    expect(unpacked.x).toBeCloseTo(150.5);
    expect(unpacked.y).toBeCloseTo(250.25);
    expect(unpacked.rotation).toBeCloseTo(1.2);
    expect(unpacked.size).toBeCloseTo(9.0);
    expect(unpacked.type).toBe(EntityTypeCode.HERBIVORE);
    expect(unpacked.healthRatio).toBeCloseTo(0.9);
    expect(unpacked.energyRatio).toBeCloseTo(0.8);
  });

  it('swaps double buffers correctly', () => {
    const packing = new RenderPackingSystem(10);
    const buf1 = packing.currentBuffer;
    packing.swapBuffers();
    const buf2 = packing.currentBuffer;
    expect(buf1).not.toBe(buf2);

    packing.swapBuffers();
    expect(packing.currentBuffer).toBe(buf1);
  });
});

