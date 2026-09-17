/**
 * Chaos Garden - Render Stride Packing System
 * 
 * Serializes active entities directly from SoA typed array columns
 * into flat binary Float32Array buffers using packEntityFieldsToStride.
 * Operates with exactly 0 byte heap allocations during continuous frames.
 */

import {
  STRIDE_FLOAT_COUNT,
  packEntityFieldsToStride,
  allocateRenderBuffer,
} from '@chaos-garden/shared';
import type { EntityPool } from '../ecs/EntityPool.js';
import type { ComponentStorage } from '../ecs/ComponentStorage.js';

export class RenderPackingSystem {
  readonly maxEntities: number;
  private _bufferA: Float32Array;
  private _bufferB: Float32Array;
  private _activeBuffer: Float32Array;

  constructor(maxEntities: number = 2000) {
    this.maxEntities = maxEntities;
    this._bufferA = allocateRenderBuffer(maxEntities);
    this._bufferB = allocateRenderBuffer(maxEntities);
    this._activeBuffer = this._bufferA;
  }

  get currentBuffer(): Float32Array {
    return this._activeBuffer;
  }

  /**
   * Packs active entities into the flat render buffer.
   * Returns the count of entities packed.
   */
  pack(pool: EntityPool, storage: ComponentStorage): number {
    const count = pool.denseCount;
    const dense = pool.denseEntities;
    const buffer = this._activeBuffer;
    const inv100 = 0.01;
    let base = 0;

    for (let i = 0; i < count; i++) {
      const idx = dense[i];

      buffer[base] = storage.idHashes[idx];
      buffer[base + 1] = storage.positionsX[idx];
      buffer[base + 2] = storage.positionsY[idx];
      buffer[base + 3] = storage.rotations[idx];
      buffer[base + 4] = storage.sizes[idx];
      buffer[base + 5] = storage.typeCodes[idx];
      buffer[base + 6] = storage.healths[idx] * inv100;
      buffer[base + 7] = storage.energies[idx] * inv100;

      base += 8;
    }

    return count;
  }

  /**
   * Swaps double buffers for zero-copy rendering thread transfers.
   */
  swapBuffers(): void {
    this._activeBuffer = this._activeBuffer === this._bufferA ? this._bufferB : this._bufferA;
  }
}
