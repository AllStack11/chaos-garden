/**
 * Chaos Garden - Living Soil Grid
 *
 * 2D matrix modeling soil moisture and nitrogen/nutrient diffusion.
 * Employs double-buffered explicit 2D Laplacian diffusion with toroidal
 * boundary wrapping and zero per-tick memory allocation.
 */

import {
  DEFAULT_SOIL_DIMENSIONS,
  DEFAULT_SOIL_CONFIG,
  type SoilGridDimensions,
  type SoilDiffusionConfig,
} from "@chaos-garden/shared";

export class SoilGrid {
  readonly dimensions: SoilGridDimensions;
  readonly config: SoilDiffusionConfig;
  readonly totalCells: number;

  private _moistureA: Float32Array;
  private _moistureB: Float32Array;
  private _nitratesA: Float32Array;
  private _nitratesB: Float32Array;

  // Active buffer references
  private _moistureCurrent: Float32Array;
  private _moistureNext: Float32Array;
  private _nitratesCurrent: Float32Array;
  private _nitratesNext: Float32Array;

  constructor(
    dimensions: SoilGridDimensions = DEFAULT_SOIL_DIMENSIONS,
    config: SoilDiffusionConfig = DEFAULT_SOIL_CONFIG,
  ) {
    this.dimensions = dimensions;
    this.config = config;
    this.totalCells = dimensions.cols * dimensions.rows;

    this._moistureA = new Float32Array(this.totalCells);
    this._moistureB = new Float32Array(this.totalCells);
    this._nitratesA = new Float32Array(this.totalCells);
    this._nitratesB = new Float32Array(this.totalCells);

    this._moistureCurrent = this._moistureA;
    this._moistureNext = this._moistureB;
    this._nitratesCurrent = this._nitratesA;
    this._nitratesNext = this._nitratesB;

    this.reset();
  }

  get cols(): number {
    return this.dimensions.cols;
  }

  get rows(): number {
    return this.dimensions.rows;
  }

  get cellSize(): number {
    return this.dimensions.cellSize;
  }

  get moisture(): Float32Array {
    return this._moistureCurrent;
  }

  get nitrates(): Float32Array {
    return this._nitratesCurrent;
  }

  /**
   * Resets soil grid to a balanced default state:
   * 50% baseline moisture, 30% baseline nitrates.
   */
  reset(initialMoisture: number = 0.5, initialNitrates: number = 0.3): void {
    this._moistureCurrent.fill(initialMoisture);
    this._moistureNext.fill(initialMoisture);
    this._nitratesCurrent.fill(initialNitrates);
    this._nitratesNext.fill(initialNitrates);
  }

  /**
   * Loads serialized moisture and nitrate values into the current and next buffers.
   */
  loadState(moisture: ArrayLike<number>, nitrates: ArrayLike<number>): void {
    const count = Math.min(this.totalCells, moisture.length, nitrates.length);
    for (let i = 0; i < count; i++) {
      const m = moisture[i];
      const n = nitrates[i];
      this._moistureCurrent[i] = m;
      this._moistureNext[i] = m;
      this._nitratesCurrent[i] = n;
      this._nitratesNext[i] = n;
    }
  }

  /**
   * Translates continuous world coordinates into flat grid cell index with toroidal wrapping.
   */
  getIndex(worldX: number, worldY: number): number {
    const { cols, rows, cellSize, worldWidth, worldHeight } = this.dimensions;

    // Toroidal coordinate wrap
    let wx = worldX % worldWidth;
    if (wx < 0) wx += worldWidth;
    let wy = worldY % worldHeight;
    if (wy < 0) wy += worldHeight;

    const col = Math.floor(wx / cellSize);
    const row = Math.floor(wy / cellSize);

    const safeCol = Math.min(Math.max(col, 0), cols - 1);
    const safeRow = Math.min(Math.max(row, 0), rows - 1);

    return safeRow * cols + safeCol;
  }

  getMoisture(worldX: number, worldY: number): number {
    return this._moistureCurrent[this.getIndex(worldX, worldY)];
  }

  getNitrates(worldX: number, worldY: number): number {
    return this._nitratesCurrent[this.getIndex(worldX, worldY)];
  }

  /**
   * Consumes nitrates at a world coordinate, returning the actual quantity extracted.
   */
  consumeNitrates(worldX: number, worldY: number, amount: number): number {
    const idx = this.getIndex(worldX, worldY);
    const available = this._nitratesCurrent[idx];
    const consumed = Math.min(available, amount);
    this._nitratesCurrent[idx] = Math.max(
      0,
      this._nitratesCurrent[idx] - consumed,
    );
    return consumed;
  }

  /**
   * Deposits organic nitrates at a world coordinate (e.g., decomposing matter).
   */
  depositNitrates(worldX: number, worldY: number, amount: number): void {
    const idx = this.getIndex(worldX, worldY);
    this._nitratesCurrent[idx] = Math.min(
      1.0,
      this._nitratesCurrent[idx] + amount,
    );
  }

  /**
   * Consumes moisture at a world coordinate, returning the actual quantity extracted.
   */
  consumeMoisture(worldX: number, worldY: number, amount: number): number {
    const idx = this.getIndex(worldX, worldY);
    const available = this._moistureCurrent[idx];
    const consumed = Math.min(available, amount);
    this._moistureCurrent[idx] = Math.max(
      0,
      this._moistureCurrent[idx] - consumed,
    );
    return consumed;
  }

  /**
   * Adds moisture to the soil at a world coordinate (e.g., rainfall).
   */
  addMoisture(worldX: number, worldY: number, amount: number): void {
    const idx = this.getIndex(worldX, worldY);
    this._moistureCurrent[idx] = Math.min(
      1.0,
      this._moistureCurrent[idx] + amount,
    );
  }

  /**
   * Performs an explicit 2D Laplacian diffusion step across both moisture and nitrates.
   * Toroidal edge wrapping prevents boundary stagnation.
   * Swaps double buffers with zero garbage collection allocations.
   */
  diffuse(
    moistureRate: number = this.config.moistureDiffusionRate,
    nitrateRate: number = this.config.nitrateDiffusionRate,
    evaporation: number = this.config.evaporationBaseRate,
  ): void {
    const cols = this.dimensions.cols;
    const rows = this.dimensions.rows;

    const curM = this._moistureCurrent;
    const nextM = this._moistureNext;
    const curN = this._nitratesCurrent;
    const nextN = this._nitratesNext;

    for (let r = 0; r < rows; r++) {
      const rUp = (r === 0 ? rows - 1 : r - 1) * cols;
      const rDown = (r === rows - 1 ? 0 : r + 1) * cols;
      const rCur = r * cols;

      for (let c = 0; c < cols; c++) {
        const cLeft = c === 0 ? cols - 1 : c - 1;
        const cRight = c === cols - 1 ? 0 : c + 1;

        const idx = rCur + c;

        // 5-point 2D discrete Laplacian: L(u) = u_up + u_down + u_left + u_right - 4 * u_center
        const laplacianM =
          curM[rUp + c] +
          curM[rDown + c] +
          curM[rCur + cLeft] +
          curM[rCur + cRight] -
          4 * curM[idx];

        const laplacianN =
          curN[rUp + c] +
          curN[rDown + c] +
          curN[rCur + cLeft] +
          curN[rCur + cRight] -
          4 * curN[idx];

        // Moisture diffusion with evaporation
        let newM = curM[idx] + moistureRate * laplacianM - evaporation;
        if (newM < 0) newM = 0;
        else if (newM > 1) newM = 1;
        nextM[idx] = newM;

        // Nitrate diffusion (conserved mass without evaporation)
        let newN = curN[idx] + nitrateRate * laplacianN;
        if (newN < 0) newN = 0;
        else if (newN > 1) newN = 1;
        nextN[idx] = newN;
      }
    }

    // Zero-allocation buffer swap
    this.swapBuffers();
  }

  /**
   * Swaps current and next buffers without allocating.
   */
  swapBuffers(): void {
    const tempM = this._moistureCurrent;
    this._moistureCurrent = this._moistureNext;
    this._moistureNext = tempM;

    const tempN = this._nitratesCurrent;
    this._nitratesCurrent = this._nitratesNext;
    this._nitratesNext = tempN;
  }
}
