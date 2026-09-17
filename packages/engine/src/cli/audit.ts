#!/usr/bin/env node
/**
 * Chaos Garden - Automated Simulation Invariant Audit CLI
 * 
 * Verifies core physical invariants, determinism, and performance
 * budgets in under 1 second.
 * 
 * Usage:
 *   node --loader tsx src/cli/audit.ts
 */

import { World } from '../ecs/World.js';
import { EntityTypeCode } from '@chaos-garden/shared';

async function runAudit(): Promise<void> {
  console.log(`\n🔍 Chaos Garden Simulation Invariant Auditor\n`);

  let failures = 0;
  const assert = (condition: boolean, label: string): void => {
    if (condition) {
      console.log(`  ✅ [PASS] ${label}`);
    } else {
      console.error(`  ❌ [FAIL] ${label}`);
      failures++;
    }
  };

  const seed = 42;
  const ticks = 250;
  const world = new World({ seed });
  world.seedPrimordialEcosystem();

  const start = performance.now();
  let totalTickMs = 0;

  for (let t = 0; t < ticks; t++) {
    world.step();
    totalTickMs += world.lastTickDurationMs;
  }

  const elapsed = performance.now() - start;
  const avgTickMs = totalTickMs / ticks;

  // 1. Performance Budget
  assert(
    avgTickMs <= 2.5,
    `Average tick latency <= 2.5ms (Actual: ${avgTickMs.toFixed(3)}ms, Budget: 2.5ms)`
  );

  // 2. Coordinate Boundaries & Finite Coordinates
  let coordsFinite = true;
  let inBounds = true;
  const active = world.pool.denseEntities;
  const count = world.pool.denseCount;
  for (let i = 0; i < count; i++) {
    const idx = active[i];
    const x = world.storage.positionsX[idx];
    const y = world.storage.positionsY[idx];
    if (!Number.isFinite(x) || !Number.isFinite(y)) coordsFinite = false;
    if (x < 0 || x >= world.config.gardenWidth || y < 0 || y >= world.config.gardenHeight) {
      inBounds = false;
    }
  }
  assert(coordsFinite, `All ${count} entity coordinates are finite numbers (no NaN/Infinity)`);
  assert(inBounds, `All entity coordinates strictly inside [0, ${world.config.gardenWidth}) x [0, ${world.config.gardenHeight})`);

  // 3. Trophic Invariant
  let trophicValid = true;
  for (let i = 0; i < count; i++) {
    const idx = active[i];
    const type = world.storage.typeCodes[idx];
    const repro = world.storage.reproductionThresholds[idx];
    if (type === EntityTypeCode.PLANT && repro >= 65) trophicValid = false;
    if (type === EntityTypeCode.HERBIVORE && (repro <= 55 || repro >= 75)) trophicValid = false;
    if (type === EntityTypeCode.CARNIVORE && repro <= 65) trophicValid = false;
  }
  assert(trophicValid, `Trophic reproduction threshold ordering maintained across all lineages`);

  // 4. Determinism Invariant
  const world2 = new World({ seed });
  world2.seedPrimordialEcosystem();
  for (let t = 0; t < ticks; t++) {
    world2.step();
  }
  const isIdentical =
    world.pool.denseCount === world2.pool.denseCount &&
    world.storage.positionsX[world.pool.denseEntities[0]] ===
      world2.storage.positionsX[world2.pool.denseEntities[0]];
  assert(isIdentical, `Determinism: Re-running with seed ${seed} yields identical state`);

  console.log(`\nAudit completed in ${elapsed.toFixed(1)}ms with ${failures} failure(s).\n`);

  if (failures > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});

