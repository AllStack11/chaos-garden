/**
 * Chaos Garden - Fixed 3-Buffer Render Buffer Pool
 *
 * Implements a bounded, zero-allocation pool of three pre-allocated render buffers.
 * Manages explicit ownership states ('available' | 'writing' | 'inFlight')
 * to handle main-thread render backpressure without simulation drift or allocations.
 */

import {
  allocateRenderBuffer,
  STRIDE_FLOAT_COUNT,
  type TransferableRenderFrame,
} from '@chaos-garden/shared';

export type BufferState = 'available' | 'writing' | 'inFlight';

export class RenderBufferPool {
  readonly maxEntities: number;
  readonly expectedByteLength: number;
  readonly buffers: [Float32Array, Float32Array, Float32Array];
  private states: [BufferState, BufferState, BufferState];
  private writingIndex: number = -1;
  private lastPackedCount: number = 0;
  private lastPackedTick: number = 0;

  constructor(maxEntities: number = 2000) {
    this.maxEntities = maxEntities;
    this.expectedByteLength = maxEntities * STRIDE_FLOAT_COUNT * 4;
    this.buffers = [
      allocateRenderBuffer(maxEntities),
      allocateRenderBuffer(maxEntities),
      allocateRenderBuffer(maxEntities),
    ];
    this.states = ['available', 'available', 'available'];
  }

  get availableCount(): number {
    let count = 0;
    for (let i = 0; i < 3; i++) {
      if (this.states[i] === 'available') count++;
    }
    return count;
  }

  get inFlightCount(): number {
    let count = 0;
    for (let i = 0; i < 3; i++) {
      if (this.states[i] === 'inFlight') count++;
    }
    return count;
  }

  get writingBuffer(): Float32Array | null {
    return this.writingIndex !== -1 ? this.buffers[this.writingIndex] : null;
  }

  /**
   * Acquires an available buffer for packing.
   * Transitions buffer state to 'writing'.
   * Returns null if no available buffer exists. Never allocates.
   */
  acquireWritingBuffer(): Float32Array | null {
    if (this.writingIndex !== -1) {
      return this.buffers[this.writingIndex];
    }
    for (let i = 0; i < 3; i++) {
      if (this.states[i] === 'available') {
        this.states[i] = 'writing';
        this.writingIndex = i;
        return this.buffers[i];
      }
    }
    return null;
  }

  /**
   * Commits the current writing buffer after entities have been packed.
   */
  commitWriting(tick: number, entityCount: number): void {
    this.lastPackedTick = tick;
    this.lastPackedCount = entityCount;
  }

  /**
   * Retrieves the transferable render frame for the completed tick.
   * Transitions the writing buffer from 'writing' to 'inFlight'.
   * Returns null if no buffer is available/ready. Never allocates.
   */
  getTransferableRenderFrame(): TransferableRenderFrame | null {
    if (this.writingIndex === -1) {
      return null;
    }
    const idx = this.writingIndex;
    this.states[idx] = 'inFlight';
    this.writingIndex = -1;
    return {
      tick: this.lastPackedTick,
      entityCount: this.lastPackedCount,
      buffer: this.buffers[idx],
    };
  }

  /**
   * Reclaims a transferred render buffer back into the pool.
   * Returns true if buffer was successfully admitted to available state.
   * Rejects unknown, duplicate, wrong-length, or already available buffers with false.
   */
  returnRenderBuffer(buffer: Float32Array): boolean {
    if (!buffer || buffer.byteLength !== this.expectedByteLength) {
      return false;
    }

    // Direct reference match (e.g. within-thread or non-detached return)
    for (let i = 0; i < 3; i++) {
      if (this.buffers[i] === buffer) {
        if (this.states[i] === 'inFlight') {
          this.states[i] = 'available';
          return true;
        }
        return false;
      }
    }

    // Zero-copy detached return match:
    // When a buffer is transferred over postMessage, the local Float32Array in the pool
    // became detached (byteLength === 0). A valid returned buffer has the expected byte length
    // and re-attaches to an inFlight detached slot.
    for (let i = 0; i < 3; i++) {
      if (this.states[i] === 'inFlight' && this.buffers[i].byteLength === 0) {
        this.buffers[i] = buffer;
        this.states[i] = 'available';
        return true;
      }
    }

    return false;
  }
}

