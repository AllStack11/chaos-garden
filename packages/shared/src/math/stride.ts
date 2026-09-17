/**
 * Chaos Garden - Binary Stride Serializer / Deserializer
 * 
 * Manages zero-copy encoding and decoding of living organisms
 * into flat Float32Array buffers for PixiJS rendering.
 */

import {
  STRIDE_FLOAT_COUNT,
  RENDER_STRIDE_OFFSET,
  type EntityRenderData
} from '../types/render.js';
import { EntityTypeCode } from '../types/taxonomy.js';

/**
 * Pre-allocates a Float32Array capable of holding maxEntities render strides.
 */
export function allocateRenderBuffer(maxEntities: number): Float32Array {
  return new Float32Array(maxEntities * STRIDE_FLOAT_COUNT);
}

/**
 * Maximum integer accurately representable in an IEEE 754 single-precision float (2^24).
 * Hashes are masked to 24 bits (16,777,215) to guarantee 100% lossless storage
 * and exact integer equality when stored in a Float32Array.
 */
export const MAX_SAFE_FLOAT32_INT = 16777215; // 0x00ffffff

/**
 * Computes a deterministic integer hash from an entity UUID string,
 * masked to 24 bits to fit losslessly inside a Float32Array without rounding.
 */
export function hashIdToFloat(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Mask to 24 bits and ensure non-zero
  const masked = (hash & MAX_SAFE_FLOAT32_INT) >>> 0;
  return masked === 0 ? 1 : masked;
}

/**
 * Writes an entity's live spatial and vital data into the flat render buffer.
 */
export function packEntityToStride(
  buffer: Float32Array,
  entityIndex: number,
  data: EntityRenderData
): void {
  const base = entityIndex * STRIDE_FLOAT_COUNT;
  buffer[base + RENDER_STRIDE_OFFSET.ID] = data.idHash;
  buffer[base + RENDER_STRIDE_OFFSET.POS_X] = data.x;
  buffer[base + RENDER_STRIDE_OFFSET.POS_Y] = data.y;
  buffer[base + RENDER_STRIDE_OFFSET.ROTATION] = data.rotation;
  buffer[base + RENDER_STRIDE_OFFSET.SIZE] = data.size;
  buffer[base + RENDER_STRIDE_OFFSET.TYPE] = data.type;
  buffer[base + RENDER_STRIDE_OFFSET.HEALTH] = data.healthRatio;
  buffer[base + RENDER_STRIDE_OFFSET.ENERGY] = data.energyRatio;
}

/**
 * Reads an entity stride from the flat render buffer.
 */
export function unpackStrideToEntity(
  buffer: Float32Array,
  entityIndex: number
): EntityRenderData {
  const base = entityIndex * STRIDE_FLOAT_COUNT;
  return {
    idHash: buffer[base + RENDER_STRIDE_OFFSET.ID],
    x: buffer[base + RENDER_STRIDE_OFFSET.POS_X],
    y: buffer[base + RENDER_STRIDE_OFFSET.POS_Y],
    rotation: buffer[base + RENDER_STRIDE_OFFSET.ROTATION],
    size: buffer[base + RENDER_STRIDE_OFFSET.SIZE],
    type: buffer[base + RENDER_STRIDE_OFFSET.TYPE] as EntityTypeCode,
    healthRatio: buffer[base + RENDER_STRIDE_OFFSET.HEALTH],
    energyRatio: buffer[base + RENDER_STRIDE_OFFSET.ENERGY],
  };
}

/**
 * Unpacks all active entities from a render frame buffer.
 * Primarily used in test suites and headless verification.
 */
export function unpackAllEntitiesFromStride(
  buffer: Float32Array,
  entityCount: number
): EntityRenderData[] {
  const result: EntityRenderData[] = new Array(entityCount);
  for (let i = 0; i < entityCount; i++) {
    result[i] = unpackStrideToEntity(buffer, i);
  }
  return result;
}

