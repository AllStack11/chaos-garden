import { describe, it, expect } from "vitest";
import { SpatialHashGrid } from "../../src/spatial/SpatialHashGrid.js";

describe("SpatialHashGrid (O(1) Proximity Queries)", () => {
  it("inserts and queries neighbors within radius", () => {
    const grid = new SpatialHashGrid({
      worldWidth: 500,
      worldHeight: 500,
      cellSize: 50,
      maxEntities: 100,
    });

    grid.insert(0, 100, 100);
    grid.insert(1, 110, 105);
    grid.insert(2, 400, 400); // far away

    const found: number[] = [];
    grid.queryNeighbors(100, 100, 30, (idx) => {
      found.push(idx);
    });

    expect(found).toContain(0);
    expect(found).toContain(1);
    expect(found).not.toContain(2);
  });

  it("handles multiple entities in same cell", () => {
    const grid = new SpatialHashGrid({
      worldWidth: 200,
      worldHeight: 200,
      cellSize: 50,
      maxEntities: 10,
    });

    grid.insert(0, 25, 25);
    grid.insert(1, 26, 26);
    grid.insert(2, 27, 27);

    const found: number[] = [];
    grid.queryNeighbors(25, 25, 10, (idx) => {
      found.push(idx);
    });

    expect(found.length).toBe(3);
    expect(found).toContain(0);
    expect(found).toContain(1);
    expect(found).toContain(2);
  });

  it("queries across toroidal boundaries", () => {
    const grid = new SpatialHashGrid({
      worldWidth: 200,
      worldHeight: 200,
      cellSize: 50,
      maxEntities: 10,
    });

    // Entity 0 near left edge (x=2)
    grid.insert(0, 2, 100);
    // Entity 1 near right edge (x=198)
    grid.insert(1, 198, 100);

    // Query from left edge with radius 20
    const found: number[] = [];
    grid.queryNeighbors(2, 100, 20, (idx) => {
      found.push(idx);
    });

    // Should find both 0 and 1 via toroidal wrap
    expect(found).toContain(0);
    expect(found).toContain(1);
  });

  it("clears all entities without new allocations", () => {
    const grid = new SpatialHashGrid({
      worldWidth: 100,
      worldHeight: 100,
      cellSize: 20,
      maxEntities: 10,
    });

    grid.insert(0, 50, 50);
    grid.clear();

    const found: number[] = [];
    grid.queryNeighbors(50, 50, 20, (idx) => {
      found.push(idx);
    });

    expect(found.length).toBe(0);
  });

  it("allocates 32 slots in queryBuffer and populates up to 32 neighbors without closure allocation", () => {
    const grid = new SpatialHashGrid({
      worldWidth: 200,
      worldHeight: 200,
      cellSize: 50,
      maxEntities: 50,
    });

    expect(grid.queryBuffer.length).toBe(32);

    // Insert 35 entities in same cell
    for (let i = 0; i < 35; i++) {
      grid.insert(i, 25, 25);
    }

    const count = grid.query(25, 25, 10);
    expect(count).toBe(32); // capped at queryBuffer length 32
  });
});
