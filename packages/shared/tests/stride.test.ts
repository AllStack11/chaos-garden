import { describe, it, expect } from 'vitest';
import {
  STRIDE_FLOAT_COUNT,
  STRIDE_BYTE_LENGTH,
  RENDER_STRIDE_OFFSET,
  type EntityRenderData,
} from '../src/types/render.js';
import { EntityTypeCode } from '../src/types/taxonomy.js';
import {
  allocateRenderBuffer,
  hashIdToFloat,
  packEntityToStride,
  packEntityFieldsToStride,
  unpackStrideToEntity,
  unpackAllEntitiesFromStride,
  MAX_SAFE_FLOAT32_INT,
} from '../src/math/stride.js';

describe('Binary Render Stride Protocol', () => {
  it('conforms to 8 floats and 32 bytes per entity stride', () => {
    expect(STRIDE_FLOAT_COUNT).toBe(8);
    expect(STRIDE_BYTE_LENGTH).toBe(32);
    expect(Object.keys(RENDER_STRIDE_OFFSET).length).toBe(8);
  });

  it('allocates render buffer with correct total byte capacity', () => {
    const maxEntities = 500;
    const buffer = allocateRenderBuffer(maxEntities);
    expect(buffer.length).toBe(maxEntities * 8);
    expect(buffer.byteLength).toBe(maxEntities * 32);
  });

  it('hashes entity IDs deterministically within safe 24-bit range', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const hash1 = hashIdToFloat(id);
    const hash2 = hashIdToFloat(id);
    expect(hash1).toBe(hash2);
    expect(Number.isInteger(hash1)).toBe(true);
    expect(hash1).toBeGreaterThan(0);
    expect(hash1).toBeLessThanOrEqual(MAX_SAFE_FLOAT32_INT);
  });

  it('packs and unpacks an entity without loss of precision', () => {
    const buffer = allocateRenderBuffer(10);
    const sample: EntityRenderData = {
      idHash: 1234567, // Fits safely within 24-bit mantissa
      x: 450.25,
      y: 312.75,
      rotation: 1.5707964,
      size: 14.5,
      type: EntityTypeCode.HERBIVORE,
      healthRatio: 0.85,
      energyRatio: 0.92,
    };

    packEntityToStride(buffer, 3, sample);
    const unpacked = unpackStrideToEntity(buffer, 3);

    expect(unpacked.idHash).toBe(sample.idHash);
    expect(unpacked.x).toBeCloseTo(sample.x);
    expect(unpacked.y).toBeCloseTo(sample.y);
    expect(unpacked.rotation).toBeCloseTo(sample.rotation);
    expect(unpacked.size).toBeCloseTo(sample.size);
    expect(unpacked.type).toBe(sample.type);
    expect(unpacked.healthRatio).toBeCloseTo(sample.healthRatio);
    expect(unpacked.energyRatio).toBeCloseTo(sample.energyRatio);
  });

  it('unpacks all entities in batch correctly', () => {
    const entityCount = 4;
    const buffer = allocateRenderBuffer(10);

    for (let i = 0; i < entityCount; i++) {
      packEntityToStride(buffer, i, {
        idHash: 100 + i,
        x: i * 50,
        y: i * 60,
        rotation: i * 0.5,
        size: 5 + i,
        type: (i % 4) as EntityTypeCode,
        healthRatio: (i + 1) / 5,
        energyRatio: (i + 1) / 4,
      });
    }

    const all = unpackAllEntitiesFromStride(buffer, entityCount);
    expect(all.length).toBe(entityCount);
    expect(all[0].idHash).toBe(100);
    expect(all[1].x).toBe(50);
    expect(all[2].type).toBe(EntityTypeCode.CARNIVORE);
    expect(all[3].size).toBe(8);
  });

  it('packs directly via packEntityFieldsToStride matching packEntityToStride output', () => {
    const buffer1 = allocateRenderBuffer(2);
    const buffer2 = allocateRenderBuffer(2);

    const sample: EntityRenderData = {
      idHash: 7654321,
      x: 123.45,
      y: 678.9,
      rotation: 2.34,
      size: 12.0,
      type: EntityTypeCode.CARNIVORE,
      healthRatio: 0.75,
      energyRatio: 0.65,
    };

    packEntityToStride(buffer1, 0, sample);
    packEntityFieldsToStride(
      buffer2,
      0,
      sample.idHash,
      sample.x,
      sample.y,
      sample.rotation,
      sample.size,
      sample.type,
      sample.healthRatio,
      sample.energyRatio
    );

    for (let i = 0; i < STRIDE_FLOAT_COUNT; i++) {
      expect(buffer2[i]).toBe(buffer1[i]);
    }

    const unpacked1 = unpackStrideToEntity(buffer1, 0);
    const unpacked2 = unpackStrideToEntity(buffer2, 0);
    expect(unpacked2).toEqual(unpacked1);
    expect(unpacked2.idHash).toBe(sample.idHash);
    expect(unpacked2.x).toBeCloseTo(sample.x);
    expect(unpacked2.y).toBeCloseTo(sample.y);
  });
});


