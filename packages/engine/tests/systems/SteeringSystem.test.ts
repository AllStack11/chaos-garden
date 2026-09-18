import { describe, it, expect } from "vitest";
import { SteeringSystem } from "../../src/systems/SteeringSystem.js";
import { EntityPool } from "../../src/ecs/EntityPool.js";
import { ComponentStorage } from "../../src/ecs/ComponentStorage.js";
import { SpatialHashGrid } from "../../src/spatial/SpatialHashGrid.js";
import { EntityTypeCode, createMulberry32 } from "@chaos-garden/shared";

describe("SteeringSystem (Craig Reynolds Behaviors)", () => {
  it("applies separation force when entities are in close proximity", () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const spatialGrid = new SpatialHashGrid({
      worldWidth: 500,
      worldHeight: 500,
      cellSize: 50,
      maxEntities: 10,
    });
    const prng = createMulberry32(42);
    const steering = new SteeringSystem();

    // Two herbivores very close to each other
    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 1,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 100,
      y: 100,
      size: 10,
      pigment: 180,
      maxSpeed: 20,
      maxForce: 5,
      perceptionRadius: 50,
      fleeRadius: 60,
    });

    const e1 = pool.allocate();
    storage.initEntity(e1, {
      idHash: 2,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 105,
      y: 100, // directly to right of e0
      size: 10,
      pigment: 180,
      maxSpeed: 20,
      maxForce: 5,
      perceptionRadius: 50,
      fleeRadius: 60,
    });

    spatialGrid.clear();
    spatialGrid.insert(e0, 100, 100);
    spatialGrid.insert(e1, 105, 100);

    steering.update(pool, storage, spatialGrid, prng);

    // e0 should be pushed left (negative X acceleration) away from e1
    expect(storage.accelerationsX[e0]).toBeLessThan(0);
    // e1 should be pushed right (positive X acceleration) away from e0
    expect(storage.accelerationsX[e1]).toBeGreaterThan(0);
  });

  it("causes herbivore to flee from carnivore", () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const spatialGrid = new SpatialHashGrid({
      worldWidth: 500,
      worldHeight: 500,
      cellSize: 50,
      maxEntities: 10,
    });
    const prng = createMulberry32(42);
    const steering = new SteeringSystem();

    const herbivore = pool.allocate();
    storage.initEntity(herbivore, {
      idHash: 10,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 200,
      y: 200,
      size: 8,
      pigment: 120,
      maxSpeed: 15,
      maxForce: 5,
      perceptionRadius: 50,
      fleeRadius: 80,
    });

    const carnivore = pool.allocate();
    storage.initEntity(carnivore, {
      idHash: 20,
      typeCode: EntityTypeCode.CARNIVORE,
      x: 230,
      y: 200, // predator 30px to right
      size: 14,
      pigment: 0,
      maxSpeed: 25,
      maxForce: 8,
      perceptionRadius: 100,
      fleeRadius: 0,
    });

    spatialGrid.clear();
    spatialGrid.insert(herbivore, 200, 200);
    spatialGrid.insert(carnivore, 230, 200);

    steering.update(pool, storage, spatialGrid, prng);

    // Herbivore should flee left (negative X)
    expect(storage.accelerationsX[herbivore]).toBeLessThan(0);
  });

  it("steers correctly across toroidal boundaries (seeking across edge)", () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const spatialGrid = new SpatialHashGrid({
      worldWidth: 500,
      worldHeight: 500,
      cellSize: 50,
      maxEntities: 10,
    });
    const prng = createMulberry32(42);
    const steering = new SteeringSystem();

    // Herbivore near left boundary (x = 5)
    const herbivore = pool.allocate();
    storage.initEntity(herbivore, {
      idHash: 100,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 5,
      y: 250,
      size: 8,
      pigment: 120,
      maxSpeed: 20,
      maxForce: 5,
      perceptionRadius: 50,
      fleeRadius: 0,
    });

    // Plant near right boundary (x = 480, 25px to the left across toroidal wrap, outside personal space 16.8px but within perception 50px)
    const plant = pool.allocate();
    storage.initEntity(plant, {
      idHash: 200,
      typeCode: EntityTypeCode.PLANT,
      x: 480,
      y: 250,
      size: 6,
      pigment: 120,
      maxSpeed: 0,
      maxForce: 0,
      perceptionRadius: 0,
      fleeRadius: 0,
    });

    spatialGrid.clear();
    spatialGrid.insert(herbivore, 5, 250);
    spatialGrid.insert(plant, 480, 250);

    steering.update(pool, storage, spatialGrid, prng, 500, 500);

    // Toroidal distance is 25px to the left (dx = -25). Herbivore should steer left (negative X) across wrap!
    expect(storage.accelerationsX[herbivore]).toBeLessThan(0);

    // Also verify toroidal separation: neighbor at x = 495 is 10px to the left across wrap (inside personal space 19.2px)
    const herbivore2 = pool.allocate();
    storage.initEntity(herbivore2, {
      idHash: 300,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 495,
      y: 250,
      size: 8,
      pigment: 120,
      maxSpeed: 20,
      maxForce: 5,
      perceptionRadius: 50,
      fleeRadius: 0,
    });
    spatialGrid.insert(herbivore2, 495, 250);

    steering.update(pool, storage, spatialGrid, prng, 500, 500);

    // herbivore2 is 10px to the left of herbivore across wrap.
    // Separation pushes herbivore2 further left (negative X) away from herbivore.
    expect(storage.accelerationsX[herbivore2]).toBeLessThan(0);
  });
});
