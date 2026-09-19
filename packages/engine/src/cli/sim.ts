#!/usr/bin/env node
/**
 * Chaos Garden - Headless Simulation CLI Runner
 * 
 * Usage:
 *   node --loader tsx src/cli/sim.ts --seed=42 --ticks=1000 --headless
 */

import { World } from '../ecs/World.js';

function parseArgs(): { seed: number; ticks: number; headless: boolean } {
  const args = process.argv.slice(2);
  let seed = 42;
  let ticks = 500;
  let headless = false;

  for (const arg of args) {
    if (arg.startsWith('--seed=')) {
      seed = parseInt(arg.split('=')[1], 10) || 42;
    } else if (arg.startsWith('--ticks=')) {
      ticks = parseInt(arg.split('=')[1], 10) || 500;
    } else if (arg === '--headless') {
      headless = true;
    }
  }

  return { seed, ticks, headless };
}

async function run(): Promise<void> {
  const { seed, ticks, headless } = parseArgs();

  console.log(`\n🌿 Chaos Garden Headless Simulation`);
  console.log(`   Seed: ${seed} | Ticks: ${ticks} | Headless: ${headless}\n`);

  const world = new World({ seed });
  world.seedPrimordialEcosystem();

  const startTime = performance.now();
  let totalTickDuration = 0;

  for (let t = 0; t < ticks; t++) {
    world.step();
    totalTickDuration += world.lastTickDurationMs;

    if (!headless && (t + 1) % 100 === 0) {
      const summary = world.getPopulationSummary();
      console.log(
        `[Tick ${(t + 1).toString().padStart(5, ' ')}] Plants: ${summary.plants.toString().padStart(4, ' ')} | ` +
        `Herbivores: ${summary.herbivores.toString().padStart(3, ' ')} | ` +
        `Carnivores: ${summary.carnivores.toString().padStart(3, ' ')} | ` +
        `Fungi: ${summary.fungi.toString().padStart(3, ' ')} | ` +
        `Total: ${summary.totalLiving.toString().padStart(4, ' ')}`
      );
    }
  }

  const elapsedMs = performance.now() - startTime;
  const avgTickMs = totalTickDuration / ticks;
  const simulatedTps = (ticks / (elapsedMs / 1000)).toFixed(0);

  console.log(`\n✅ Simulation Finished`);
  console.log(`   Elapsed Real Time: ${elapsedMs.toFixed(2)}ms`);
  console.log(`   Average Tick Time: ${avgTickMs.toFixed(3)}ms`);
  console.log(`   Simulation Speed:  ${simulatedTps} TPS (${(parseFloat(simulatedTps) / 60).toFixed(1)}x real-time)\n`);

  const finalDiag = world.flightRecorder.getDiagnosticSnapshot(world);
  console.log(world.flightRecorder.formatMarkdown(finalDiag));
  console.log('');
}

run().catch((err) => {
  console.error('Simulation run failed:', err);
  process.exit(1);
});

