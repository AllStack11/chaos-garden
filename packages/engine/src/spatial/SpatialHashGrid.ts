/**
 * Chaos Garden - Spatial Hash Grid
 *
 * Partitions 2D world space into uniform buckets to accelerate proximity,
 * flocking, grazing, and predation queries from O(N^2) to O(1) average time.
 * Uses zero-allocation linked-list arrays (cellHead and nextEntity).
 */

export interface SpatialGridConfig {
  worldWidth: number;
  worldHeight: number;
  cellSize: number;
  maxEntities: number;
}

export const DEFAULT_SPATIAL_CONFIG: SpatialGridConfig = {
  worldWidth: 1600,
  worldHeight: 1200,
  cellSize: 32,
  maxEntities: 2000,
};

export class SpatialHashGrid {
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly numBuckets: number;
  readonly maxEntities: number;

  /** Head pointer of linked list for each spatial bucket (-1 for empty) */
  readonly cellHead: Int32Array;

  /** Pointer to next entity index in same bucket (-1 for list tail) */
  readonly nextEntity: Int32Array;

  /** Pre-allocated buffer for zero-closure neighbor queries */
  readonly queryBuffer: Int32Array;

  constructor(config: SpatialGridConfig = DEFAULT_SPATIAL_CONFIG) {
    this.worldWidth = config.worldWidth;
    this.worldHeight = config.worldHeight;
    this.cellSize = config.cellSize;
    this.maxEntities = config.maxEntities;

    this.cols = Math.ceil(this.worldWidth / this.cellSize);
    this.rows = Math.ceil(this.worldHeight / this.cellSize);
    this.numBuckets = this.cols * this.rows;

    this.cellHead = new Int32Array(this.numBuckets);
    this.nextEntity = new Int32Array(this.maxEntities);
    this.queryBuffer = new Int32Array(16);
    this.queryBuffer = new Int32Array(32);

    this.clear();
  }

  /**
   * Resets all bucket head pointers to -1.
   * Call once at the start of each simulation tick.
   */
  clear(): void {
    this.cellHead.fill(-1);
    this.nextEntity.fill(-1);
  }

  /**
   * Translates world coordinates into bucket index with toroidal wrapping.
   */
  getBucketIndex(x: number, y: number): number {
    let wx = x % this.worldWidth;
    if (wx < 0) wx += this.worldWidth;
    let wy = y % this.worldHeight;
    if (wy < 0) wy += this.worldHeight;

    const col = Math.min(
      Math.max(Math.floor(wx / this.cellSize), 0),
      this.cols - 1,
    );
    const row = Math.min(
      Math.max(Math.floor(wy / this.cellSize), 0),
      this.rows - 1,
    );

    return row * this.cols + col;
  }

  /**
   * Inserts an entity into the grid. O(1) prepend to bucket linked-list.
   */
  insert(entityIndex: number, x: number, y: number): void {
    if (entityIndex < 0 || entityIndex >= this.maxEntities) {
      return;
    }

    const bucket = this.getBucketIndex(x, y);
    this.nextEntity[entityIndex] = this.cellHead[bucket];
    this.cellHead[bucket] = entityIndex;
  }

  /**
   * Queries all entities within radial distance of (x, y).
   * Calls callback with each candidate entity index with 0 heap allocations.
   */
  queryNeighbors(
    x: number,
    y: number,
    radius: number,
    callback: (neighborIndex: number) => void,
  ): void {
    const minCol = Math.floor((x - radius) / this.cellSize);
    const maxCol = Math.floor((x + radius) / this.cellSize);
    const minRow = Math.floor((y - radius) / this.cellSize);
    const maxRow = Math.floor((y + radius) / this.cellSize);

    // Bounding box range, capped by grid dimensions
    const colSpan = Math.min(maxCol - minCol + 1, this.cols);
    const rowSpan = Math.min(maxRow - minRow + 1, this.rows);

    for (let rOffset = 0; rOffset < rowSpan; rOffset++) {
      let r = (minRow + rOffset) % this.rows;
      if (r < 0) r += this.rows;
      const rBase = r * this.cols;

      for (let cOffset = 0; cOffset < colSpan; cOffset++) {
        let c = (minCol + cOffset) % this.cols;
        if (c < 0) c += this.cols;

        const bucket = rBase + c;
        let curr = this.cellHead[bucket];

        while (curr !== -1) {
          callback(curr);
          curr = this.nextEntity[curr];
        }
      }
    }
  }

  /**
   * Queries nearby entities and stores up to queryBuffer.length indices
   * in queryBuffer with exactly 0 byte heap allocations and no closure creation.
   * Optimized with a branchless fast-path for interior queries.
   *
   * @returns Number of neighbor entities populated into queryBuffer.
   */
  query(x: number, y: number, radius: number): number {
    const minCol = Math.floor((x - radius) / this.cellSize);
    const maxCol = Math.floor((x + radius) / this.cellSize);
    const minRow = Math.floor((y - radius) / this.cellSize);
    const maxRow = Math.floor((y + radius) / this.cellSize);

    const cols = this.cols;
    const rows = this.rows;
    const buf = this.queryBuffer;
    const max = buf.length;
    let count = 0;

    // Fast-path: Interior queries that do not touch toroidal boundaries (95%+ of queries)
    if (minCol >= 0 && maxCol < cols && minRow >= 0 && maxRow < rows) {
      for (let r = minRow; r <= maxRow; r++) {
        const rBase = r * cols;
        for (let c = minCol; c <= maxCol; c++) {
          let curr = this.cellHead[rBase + c];
          while (curr !== -1) {
            buf[count++] = curr;
            if (count >= max) return count;
            curr = this.nextEntity[curr];
          }
        }
      }
      return count;
    }

    // Boundary wrapping fallback path
    const colSpan = Math.min(maxCol - minCol + 1, cols);
    const rowSpan = Math.min(maxRow - minRow + 1, rows);

    for (let rOffset = 0; rOffset < rowSpan; rOffset++) {
      let r = (minRow + rOffset) % rows;
      if (r < 0) r += rows;
      const rBase = r * cols;

      for (let cOffset = 0; cOffset < colSpan; cOffset++) {
        let c = (minCol + cOffset) % cols;
        if (c < 0) c += cols;

        let curr = this.cellHead[rBase + c];
        while (curr !== -1) {
          buf[count++] = curr;
          if (count >= max) return count;
          curr = this.nextEntity[curr];
        }
      }
    }

    return count;
  }
}
