import { describe, it, expect } from 'vitest';
import { FlightRecorder } from '../../src/diagnostics/FlightRecorder.js';
import { World } from '../../src/ecs/World.js';

describe('FlightRecorder (300-Tick Ring Buffer & Diagnostics)', () => {
  it('records tick telemetry into pre-allocated ring buffer', () => {
    const recorder = new FlightRecorder(10);
    const world = new World({ seed: 42 });
    world.seedPrimordialEcosystem();

    for (let i = 0; i < 5; i++) {
      world.step();
      recorder.recordTick(world);
    }

    expect(recorder.count).toBe(5);
    const snapshot = recorder.getSnapshot();
    expect(snapshot.historyLength).toBe(5);
    expect(snapshot.populationHistory.length).toBe(5);
    expect(snapshot.tickRange.start).toBe(1);
    expect(snapshot.tickRange.end).toBe(5);
  });

  it('rolls over cleanly without memory growth when capacity is reached', () => {
    const recorder = new FlightRecorder(5);
    const world = new World({ seed: 42 });
    world.seedPrimordialEcosystem();

    for (let i = 0; i < 12; i++) {
      world.step();
      recorder.recordTick(world);
    }

    expect(recorder.count).toBe(5);
    const snapshot = recorder.getSnapshot();
    expect(snapshot.historyLength).toBe(5);
    expect(snapshot.tickRange.end).toBe(12);
    expect(snapshot.tickRange.start).toBe(8);
  });

  it('generates markdown diagnostic summary for LLM prompt', () => {
    const recorder = new FlightRecorder(10);
    const world = new World({ seed: 42 });
    world.seedPrimordialEcosystem();
    world.step();
    recorder.recordTick(world);

    const diag = recorder.getDiagnosticSnapshot(world);
    const md = recorder.formatMarkdown(diag);

    expect(md).toContain('Chaos Garden Diagnostic Snapshot');
    expect(md).toContain('Seed');
    expect(md).toContain('Populations');
    expect(md).toContain('Vitals');
  });
});

