import { describe, it, expect } from 'vitest';
import type {
  DiagnosticSnapshot,
  StructuredLogEvent,
  LogLevel,
} from '../src/types/diagnostics.js';

describe('Observability & LLM Diagnostic Schemas', () => {
  it('formats valid structured log events', () => {
    const event: StructuredLogEvent = {
      tick: 1420,
      timestamp: new Date().toISOString(),
      level: 'WARN',
      component: 'METABOLISM',
      event: 'TROPHIC_COLLAPSE_RISK',
      message: 'Carnivore population critically low',
      data: { carnivores: 2, herbivores: 80 },
    };

    expect(event.tick).toBe(1420);
    expect(event.level).toBe('WARN');
    expect(event.data?.carnivores).toBe(2);

    const jsonl = JSON.stringify(event);
    const parsed = JSON.parse(jsonl) as StructuredLogEvent;
    expect(parsed.event).toBe('TROPHIC_COLLAPSE_RISK');
  });

  it('validates DiagnosticSnapshot structure for LLM consumption', () => {
    const snapshot: DiagnosticSnapshot = {
      tick: 500,
      timestamp: new Date().toISOString(),
      seed: 42,
      tps: 60.0,
      tickDurationMs: 1.5,
      populations: {
        plants: 120,
        herbivores: 45,
        carnivores: 10,
        fungi: 22,
        deadMatterCount: 8,
        totalLiving: 197,
        totalBiomass: 8500,
        allTimeBirths: 310,
        allTimeDeaths: 113,
      },
      vitals: {
        totalLiving: 197,
        totalBiomass: 8500,
        avgEnergy: 64.2,
        avgHealth: 92.1,
        predatorPreyRatio: 10 / 45,
        soilAverageMoisture: 0.58,
        soilAverageNitrates: 0.35,
        aridLandPercentage: 0.04,
        biodiversityIndex: 0.85,
      },
      recentAnomalies: [],
      reproducibleSeed: 42,
    };

    expect(snapshot.reproducibleSeed).toBe(42);
    expect(snapshot.populations.totalLiving).toBe(197);
    expect(snapshot.vitals.predatorPreyRatio).toBeCloseTo(0.222, 2);
  });
});

