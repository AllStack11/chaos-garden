/**
 * Chaos Garden - Generational Free-List Entity Pool
 * 
 * Manages entity allocation and recycling with O(1) time complexity,
 * generational versioning to prevent stale reference bugs, and dense
 * array compaction to maximize cache locality during system updates.
 */

import type { EntityPoolSnapshot } from '@chaos-garden/shared';

export class EntityPool {
  readonly capacity: number;
  readonly generations: Uint16Array;
  readonly freeList: Uint32Array;
  readonly denseEntities: Uint32Array;
  readonly sparseIndices: Int32Array;

  private _denseCount: number = 0;
  private _freeCount: number = 0;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error(`EntityPool capacity must be greater than 0, received ${capacity}`);
    }
    this.capacity = capacity;
    this.generations = new Uint16Array(capacity);
    this.freeList = new Uint32Array(capacity);
    this.denseEntities = new Uint32Array(capacity);
    this.sparseIndices = new Int32Array(capacity);

    this.reset();
  }

  /**
   * Resets the pool to its initial empty state.
   */
  reset(): void {
    this._denseCount = 0;
    this._freeCount = this.capacity;

    for (let i = 0; i < this.capacity; i++) {
      // Free list stack ordered so slot 0 is popped first
      this.freeList[i] = this.capacity - 1 - i;
      this.sparseIndices[i] = -1;
    }
  }

  /**
   * Current number of active entities in the simulation.
   */
  get denseCount(): number {
    return this._denseCount;
  }

  /**
   * Current number of unallocated slots available.
   */
  get freeCount(): number {
    return this._freeCount;
  }

  /**
   * Allocates an entity slot.
   * 
   * @returns Entity index (0 to capacity-1) or -1 if the pool is exhausted.
   */
  allocate(): number {
    if (this._freeCount === 0) {
      return -1;
    }

    this._freeCount--;
    const index = this.freeList[this._freeCount];

    const densePos = this._denseCount;
    this.denseEntities[densePos] = index;
    this.sparseIndices[index] = densePos;
    this._denseCount++;

    return index;
  }

  /**
   * Frees an active entity slot, performing O(1) dense array compaction
   * and incrementing the generation counter.
   * 
   * @param index The entity slot index to free.
   * @returns True if successfully freed, false if index was invalid or not active.
   */
  free(index: number): boolean {
    if (index < 0 || index >= this.capacity) {
      return false;
    }

    const densePos = this.sparseIndices[index];
    if (densePos === -1) {
      // Entity is already free / not active
      return false;
    }

    const lastDensePos = this._denseCount - 1;
    const lastIndex = this.denseEntities[lastDensePos];

    // Swap-and-pop compaction: move last active entity into the vacated slot
    if (densePos !== lastDensePos) {
      this.denseEntities[densePos] = lastIndex;
      this.sparseIndices[lastIndex] = densePos;
    }

    this._denseCount--;
    this.sparseIndices[index] = -1;

    // Push index back onto free list stack
    this.freeList[this._freeCount] = index;
    this._freeCount++;

    // Increment generational tag (16-bit wrapping)
    this.generations[index] = (this.generations[index] + 1) & 0xffff;

    return true;
  }

  /**
   * Checks whether an entity index and its generation are currently active and valid.
   */
  isValid(index: number, generation: number): boolean {
    if (index < 0 || index >= this.capacity) {
      return false;
    }
    return this.sparseIndices[index] !== -1 && this.generations[index] === generation;
  }

  /**
   * Checks whether an entity index is currently active, irrespective of generation.
   */
  isActive(index: number): boolean {
    if (index < 0 || index >= this.capacity) {
      return false;
    }
    return this.sparseIndices[index] !== -1;
  }

  /**
   * Serializes the exact generational free-list and dense packing state.
   */
  exportState(): EntityPoolSnapshot {
    return {
      capacity: this.capacity,
      denseCount: this._denseCount,
      freeCount: this._freeCount,
      generations: Array.from(this.generations),
      freeList: Array.from(this.freeList),
      denseEntities: Array.from(this.denseEntities),
      sparseIndices: Array.from(this.sparseIndices),
    };
  }

  setDenseCount(count: number): void {
    this._denseCount = count;
  }

  setFreeCount(count: number): void {
    this._freeCount = count;
  }

  /**
   * Restores exact generational free-list, dense packing, and active count.
   */
  loadState(state: EntityPoolSnapshot): void {
    this._denseCount = state.denseCount;
    this._freeCount = state.freeCount;
    this.generations.set(state.generations);
    this.freeList.set(state.freeList);
    this.denseEntities.set(state.denseEntities);
    this.sparseIndices.set(state.sparseIndices);
  }
}

