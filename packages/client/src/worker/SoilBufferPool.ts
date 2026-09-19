/**
 * Chaos Garden - Pre-allocated Double-Buffered Soil Texture Pool
 *
 * Enforces unconditional zero-allocation transfer of soil moisture and nitrate grids.
 * Provides fixed paired buffer slots and natural backpressure if rendering falls behind.
 */

export class SoilBufferPool {
  private readonly slotMoisture: (Float32Array | null)[] = [null, null];
  private readonly slotNitrates: (Float32Array | null)[] = [null, null];
  private readonly freeSlots: number[] = [0, 1];
  private freeCount: number = 0;

  init(cols: number, rows: number): void {
    const size = cols * rows;
    this.slotMoisture[0] = new Float32Array(size);
    this.slotMoisture[1] = new Float32Array(size);
    this.slotNitrates[0] = new Float32Array(size);
    this.slotNitrates[1] = new Float32Array(size);
    this.freeSlots[0] = 0;
    this.freeSlots[1] = 1;
    this.freeCount = 2;
  }

  acquireSlot(): number {
    if (this.freeCount === 0) {
      return -1; // Backpressure: all slots in-flight to main thread
    }
    this.freeCount--;
    return this.freeSlots[this.freeCount];
  }

  getMoisture(slot: number): Float32Array {
    return this.slotMoisture[slot]!;
  }

  getNitrates(slot: number): Float32Array {
    return this.slotNitrates[slot]!;
  }

  detachSlot(slot: number): void {
    this.slotMoisture[slot] = null;
    this.slotNitrates[slot] = null;
  }

  release(moisture: Float32Array, nitrates: Float32Array): void {
    if (!moisture || moisture.byteLength === 0 || !nitrates || nitrates.byteLength === 0) {
      return;
    }
    for (let i = 0; i < 2; i++) {
      if (this.slotMoisture[i] === null) {
        this.slotMoisture[i] = moisture;
        this.slotNitrates[i] = nitrates;
        this.freeSlots[this.freeCount] = i;
        this.freeCount++;
        return;
      }
    }
  }
}

