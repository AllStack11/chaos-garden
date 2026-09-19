/**
 * Chaos Garden - Render Stride Packing System
 *
 * Serializes active entities directly from SoA typed array columns
 * into flat binary Float32Array buffers using packEntityFieldsToStride.
 * Operates with exactly 0 byte heap allocations during continuous frames.
 * Uses a fixed 3-buffer RenderBufferPool with explicit ownership states.
 */

import {
  STRIDE_FLOAT_COUNT,
  allocateRenderBuffer,
} from "@chaos-garden/shared";
import type { TransferableRenderFrame } from "@chaos-garden/shared";
import type { EntityPool } from "../ecs/EntityPool.js";
import type { ComponentStorage } from "../ecs/ComponentStorage.js";
import { RenderBufferPool } from "./RenderBufferPool.js";

export class RenderPackingSystem {
  readonly maxEntities: number;
  readonly pool: RenderBufferPool;

  constructor(maxEntities: number = 2000) {
    this.maxEntities = maxEntities;
    this.pool = new RenderBufferPool(maxEntities);
  }

  get currentBuffer(): Float32Array {
    return (
      this.pool.writingBuffer ??
      this.pool.acquireWritingBuffer() ??
      this.pool.buffers[0]
    );
  }

  /**
   * Packs active entities into an available render buffer from the fixed pool.
   * Returns the count of entities packed, or 0 if no buffer was available.
   * Never allocates heap memory.
   */
  pack(pool: EntityPool, storage: ComponentStorage, tick: number = 0): number {
    const buffer = this.pool.acquireWritingBuffer();
    if (!buffer || buffer.byteLength === 0) {
      // All buffers in flight; skip publishing this visual frame (zero alloc, no stall)
      return 0;
    }

    const count = pool.denseCount;
    const dense = pool.denseEntities;
    const inv100 = 0.01;
    let base = 0;

    const idHashes = storage.idHashes;
    const posXs = storage.positionsX;
    const posYs = storage.positionsY;
    const rotations = storage.rotations;
    const sizes = storage.sizes;
    const typeCodes = storage.typeCodes;
    const healths = storage.healths;
    const energies = storage.energies;

    for (let i = 0; i < count; i++) {
      const idx = dense[i];

      buffer[base] = idHashes[idx];
      buffer[base + 1] = posXs[idx];
      buffer[base + 2] = posYs[idx];
      buffer[base + 3] = rotations[idx];
      buffer[base + 4] = sizes[idx];
      buffer[base + 5] = typeCodes[idx];
      buffer[base + 6] = healths[idx] * inv100;
      buffer[base + 7] = energies[idx] * inv100;

      base += 8;
    }

    this.pool.commitWriting(tick, count);
    return count;
  }

  /**
   * Retrieves the transferable render frame for the completed tick.
   * Returns null if no frame buffer was available.
   */
  getTransferableRenderFrame(): TransferableRenderFrame | null {
    return this.pool.getTransferableRenderFrame();
  }

  /**
   * Reclaims a transferred render buffer back into the fixed pool.
   */
  returnRenderBuffer(buffer: Float32Array): boolean {
    return this.pool.returnRenderBuffer(buffer);
  }

  /**
   * Backward-compatible buffer swap alias.
   */
  swapBuffers(): void {
    if (this.pool.writingBuffer) {
      this.pool.getTransferableRenderFrame();
    }
    this.pool.acquireWritingBuffer();
  }

  /**
   * Backward-compatible buffer return alias.
   */
  returnBuffer(buffer: Float32Array): void {
    this.pool.returnRenderBuffer(buffer);
  }
}
