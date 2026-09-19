import { describe, it, expect } from "vitest";
import { World } from "../../src/ecs/World.js";
import { EntityTypeCode } from "@chaos-garden/shared";

describe("World (ECS Orchestrator & Execution Pipeline)", () => {
  it("seeds primordial ecosystem with correct kingdom distributions", () => {
    const world = new World({ seed: 42 });
    world.seedPrimordialEcosystem();

    const summary = world.getPopulationSummary();
    expect(summary.plants).toBe(world.config.initialPlants);
    expect(summary.herbivores).toBe(world.config.initialHerbivores);
    expect(summary.carnivores).toBe(world.config.initialCarnivores);
    expect(summary.fungi).toBe(world.config.initialFungi);
    expect(summary.totalLiving).toBe(
      world.config.initialPlants +
        world.config.initialHerbivores +
        world.config.initialCarnivores +
        world.config.initialFungi,
    );
  });

  it("steps through simulation ticks and updates render frames", () => {
    const world = new World({ seed: 42 });
    world.seedPrimordialEcosystem();

    const initialTick = world.tick;
    expect(initialTick).toBe(0);

    // Step 5 ticks
    for (let i = 0; i < 5; i++) {
      world.step();
    }

    expect(world.tick).toBe(5);
    expect(world.lastTickDurationMs).toBeGreaterThanOrEqual(0);

    const frame = world.getRenderFrame();
    expect(frame.tick).toBe(5);
    expect(frame.entityCount).toBeGreaterThan(0);
    expect(frame.buffer.length).toBe(world.config.maxTotalEntities * 8);
  });

  it("maintains deterministic execution across identical seeds", () => {
    const worldA = new World({ seed: 12345 });
    worldA.seedPrimordialEcosystem();

    const worldB = new World({ seed: 12345 });
    worldB.seedPrimordialEcosystem();

    // Step both 50 ticks
    for (let i = 0; i < 50; i++) {
      worldA.step();
      worldB.step();
    }

    expect(worldA.pool.denseCount).toBe(worldB.pool.denseCount);
    expect(worldA.getPopulationSummary()).toEqual(
      worldB.getPopulationSummary(),
    );

    // Compare first 10 entities positions
    for (let i = 0; i < Math.min(10, worldA.pool.denseCount); i++) {
      const idxA = worldA.pool.denseEntities[i];
      const idxB = worldB.pool.denseEntities[i];
      expect(worldA.storage.positionsX[idxA]).toBeCloseTo(
        worldB.storage.positionsX[idxB],
      );
      expect(worldA.storage.positionsY[idxA]).toBeCloseTo(
        worldB.storage.positionsY[idxB],
      );
      expect(worldA.storage.energies[idxA]).toBeCloseTo(
        worldB.storage.energies[idxB],
      );
    }
  });

  it("exposes getTransferableRenderFrame with double-buffered swapping", () => {
    const world = new World({ seed: 42 });
    world.seedPrimordialEcosystem();
    world.step();

    const frameA = world.getTransferableRenderFrame();
    expect(frameA.tick).toBe(1);
    expect(frameA.entityCount).toBeGreaterThan(0);
    expect(frameA.buffer.length).toBe(world.config.maxTotalEntities * 8);

    world.step();
    const frameB = world.getTransferableRenderFrame();
    expect(frameB.tick).toBe(2);
    // Double buffering: frameB buffer is the alternate buffer instance
    expect(frameB.buffer).not.toBe(frameA.buffer);

    world.step();
    // Reclaiming/recycling buffer
    world.returnRenderBuffer(frameA.buffer);
    const frameC = world.getTransferableRenderFrame();
    expect(frameC.tick).toBe(3);
    // Should reuse frameA's buffer
    expect(frameC.buffer).toBe(frameA.buffer);
  });

  it("losslessly exports and hydrates simulation state from CanonicalWorldState", () => {
    const originalWorld = new World({ seed: 777 });
    originalWorld.seedPrimordialEcosystem();
    for (let i = 0; i < 25; i++) {
      originalWorld.step();
    }

    const exportedState = originalWorld.exportCanonicalState();
    expect(exportedState.tick).toBe(25);
    expect(exportedState.entities.length).toBe(originalWorld.pool.denseCount);
    expect(exportedState.soil.moisture.length).toBe(
      originalWorld.soil.totalCells,
    );

    // Create a new world and hydrate it
    const restoredWorld = new World({ seed: 777 });
    const success = restoredWorld.hydrateCanonicalState(exportedState);
    expect(success).toBe(true);

    expect(restoredWorld.tick).toBe(25);
    expect(restoredWorld.pool.denseCount).toBe(originalWorld.pool.denseCount);
    expect(restoredWorld.getPopulationSummary()).toEqual(
      originalWorld.getPopulationSummary(),
    );

    // Compare soil
    expect(restoredWorld.soil.getMoisture(100, 100)).toBeCloseTo(
      originalWorld.soil.getMoisture(100, 100),
    );
    expect(restoredWorld.soil.getNitrates(100, 100)).toBeCloseTo(
      originalWorld.soil.getNitrates(100, 100),
    );
  });
});
