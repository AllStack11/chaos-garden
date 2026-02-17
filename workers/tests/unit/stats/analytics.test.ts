import { describe, expect, it } from 'vitest';
import type {
  Entity,
  EventSeverityBreakdown,
  EventTypeBreakdown,
  GardenState,
  WeatherStateName,
} from '@chaos-garden/shared';
import {
  buildInsights,
  calculateAggregate,
  calculateEntityVitals,
  toGardenStatsPoint,
} from '../../../src/stats/analytics';

function buildGardenState(overrides: Partial<GardenState> = {}): GardenState {
  return {
    id: 1,
    tick: 50,
    timestamp: '2026-01-01T00:00:00.000Z',
    environment: {
      tick: 50,
      temperature: 22,
      sunlight: 0.6,
      moisture: 0.4,
      weatherState: {
        currentState: 'RAIN',
        stateEnteredAtTick: 44,
        plannedDurationTicks: 12,
        previousState: 'CLEAR',
        transitionProgressTicks: 0,
      },
    },
    populationSummary: {
      plants: 20,
      herbivores: 10,
      carnivores: 4,
      fungi: 8,
      deadPlants: 2,
      deadHerbivores: 1,
      deadCarnivores: 0,
      deadFungi: 0,
      allTimeDeadPlants: 30,
      allTimeDeadHerbivores: 15,
      allTimeDeadCarnivores: 5,
      allTimeDeadFungi: 3,
      total: 45,
      totalLiving: 42,
      totalDead: 3,
      allTimeDead: 53,
    },
    ...overrides,
  };
}

function buildPoint(
  tick: number,
  living: number,
  dead: number,
  plants: number,
  herbivores: number,
  carnivores: number,
  fungi: number,
  weatherState: WeatherStateName | null = null
) {
  return {
    tick,
    timestamp: `2026-01-01T00:${tick.toString().padStart(2, '0')}:00.000Z`,
    populations: {
      plants,
      herbivores,
      carnivores,
      fungi,
      living,
      dead,
    },
    environment: {
      temperature: 18 + tick * 0.2,
      sunlight: 0.3 + tick * 0.01,
      moisture: 0.55 - tick * 0.005,
      weatherState,
    },
  };
}

function buildEntity(id: string, type: Entity['type'], age: number, energy: number, health: number): Entity {
  return {
    id,
    gardenStateId: 1,
    bornAtTick: 1,
    isAlive: true,
    type,
    name: `${type}-${id}`,
    species: `${type}-species`,
    position: { x: 10, y: 10 },
    energy,
    health,
    age,
    lineage: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(type === 'plant'
      ? {
        growthRate: 1,
        reproductionRate: 0.1,
        photosynthesisEfficiency: 0.8,
      }
      : type === 'herbivore'
        ? {
          movementSpeed: 2,
          perceptionRadius: 80,
          reproductionRate: 0.2,
          diet: 'plant' as const,
          threatDetectionRadius: 120,
        }
        : type === 'carnivore'
          ? {
            movementSpeed: 2.5,
            perceptionRadius: 90,
            reproductionRate: 0.12,
            diet: 'herbivore' as const,
            huntSuccessRate: 0.6,
          }
          : {
            decompositionRate: 0.5,
            sporeProductionRate: 0.25,
            decompositionRadius: 100,
            reproductionRate: 0.15,
          }),
  };
}

describe('stats/analytics', () => {
  it('maps garden state into a stats point', () => {
    const point = toGardenStatsPoint(buildGardenState());

    expect(point).toEqual({
      tick: 50,
      timestamp: '2026-01-01T00:00:00.000Z',
      populations: {
        plants: 20,
        herbivores: 10,
        carnivores: 4,
        fungi: 8,
        living: 42,
        dead: 3,
      },
      environment: {
        temperature: 22,
        sunlight: 0.6,
        moisture: 0.4,
        weatherState: 'RAIN',
      },
    });
  });

  it('returns null stats point when state is null', () => {
    expect(toGardenStatsPoint(null)).toBeNull();
  });

  it('calculates aggregate deltas, rates, volatility, and climate trends', () => {
    const history = [
      buildPoint(10, 30, 2, 16, 8, 3, 3, 'CLEAR'),
      buildPoint(11, 34, 3, 18, 9, 3, 4, 'RAIN'),
      buildPoint(12, 40, 4, 21, 10, 4, 5, 'RAIN'),
    ];

    const aggregate = calculateAggregate(history);

    expect(aggregate.tickSpan).toBe(2);
    expect(aggregate.deltas).toEqual({
      plants: 5,
      herbivores: 2,
      carnivores: 1,
      fungi: 2,
      living: 10,
      dead: 2,
    });
    expect(aggregate.growthRates.livingPerTick).toBe(5);
    expect(aggregate.growthRates.deadPerTick).toBe(1);
    expect(aggregate.predatorPreyRatio).toBe(0.4);
    expect(aggregate.decompositionPressure).toBe(0.8);
    expect(aggregate.trendSlopes.temperature).toBeCloseTo(0.2, 4);
    expect(aggregate.trendSlopes.sunlight).toBeCloseTo(0.01, 4);
    expect(aggregate.trendSlopes.moisture).toBeCloseTo(-0.005, 4);
    expect(aggregate.averageEnvironment.temperature).toBeCloseTo(20.2, 4);
    expect(aggregate.averageEnvironment.sunlight).toBeCloseTo(0.41, 4);
    expect(aggregate.averageEnvironment.moisture).toBeCloseTo(0.495, 4);
    expect(aggregate.populationVolatility).toBeGreaterThan(0);
    expect(aggregate.biodiversityIndex).toBeGreaterThan(0);
  });

  it('returns zeroed aggregate for empty history', () => {
    const aggregate = calculateAggregate([]);

    expect(aggregate).toEqual({
      tickSpan: 0,
      deltas: { plants: 0, herbivores: 0, carnivores: 0, fungi: 0, living: 0, dead: 0 },
      growthRates: { livingPerTick: 0, deadPerTick: 0 },
      mortalityPressure: 0,
      populationVolatility: 0,
      biodiversityIndex: 0,
      predatorPreyRatio: 0,
      decompositionPressure: 0,
      averageEnvironment: { temperature: 0, sunlight: 0, moisture: 0 },
      trendSlopes: { temperature: 0, sunlight: 0, moisture: 0 },
    });
  });

  it('calculates entity vitals by cohort and type', () => {
    const entities = [
      buildEntity('p1', 'plant', 5, 60, 95),
      buildEntity('h1', 'herbivore', 8, 55, 70),
      buildEntity('h2', 'herbivore', 20, 75, 85),
      buildEntity('c1', 'carnivore', 25, 42, 66),
      buildEntity('f1', 'fungus', 12, 50, 80),
    ];

    const vitals = calculateEntityVitals(entities);

    expect(vitals.totalLiving).toBe(5);
    expect(vitals.oldestLivingAge).toBe(25);
    expect(vitals.youngestLivingAge).toBe(5);
    expect(vitals.youngestCohortCount).toBe(3);
    expect(vitals.byType.herbivore.count).toBe(2);
    expect(vitals.byType.herbivore.averageEnergy).toBe(65);
    expect(vitals.byType.herbivore.averageHealth).toBe(77.5);
  });

  it('returns zeroed vitals when no living entities exist', () => {
    const vitals = calculateEntityVitals([]);

    expect(vitals.totalLiving).toBe(0);
    expect(vitals.byType.plant.count).toBe(0);
    expect(vitals.averageEnergyAcrossLiving).toBe(0);
  });

  it('builds deterministic insight set from aggregate and event signals', () => {
    const history = [
      {
        tick: 40,
        timestamp: '2026-01-01T00:40:00.000Z',
        populations: { plants: 40, herbivores: 20, carnivores: 18, fungi: 4, living: 80, dead: 10 },
        environment: { temperature: 28, sunlight: 0.18, moisture: 0.22, weatherState: 'DROUGHT' },
      },
      {
        tick: 41,
        timestamp: '2026-01-01T00:41:00.000Z',
        populations: { plants: 35, herbivores: 18, carnivores: 19, fungi: 3, living: 72, dead: 15 },
        environment: { temperature: 29, sunlight: 0.17, moisture: 0.2, weatherState: 'DROUGHT' },
      },
      {
        tick: 42,
        timestamp: '2026-01-01T00:42:00.000Z',
        populations: { plants: 30, herbivores: 15, carnivores: 20, fungi: 2, living: 67, dead: 21 },
        environment: { temperature: 30, sunlight: 0.16, moisture: 0.18, weatherState: 'DROUGHT' },
      },
    ];
    const aggregate = calculateAggregate(history);
    const eventBreakdown: EventTypeBreakdown[] = [
      { eventType: 'DEATH', count: 12 },
      { eventType: 'BIRTH', count: 2 },
    ];
    const severityBreakdown: EventSeverityBreakdown[] = [
      { severity: 'CRITICAL', count: 1 },
      { severity: 'HIGH', count: 4 },
    ];

    const insights = buildInsights(history, aggregate, eventBreakdown, severityBreakdown);

    const insightKinds = insights.map((insight) => insight.kind);
    expect(insightKinds).toContain('COLLAPSE_RISK');
    expect(insightKinds).toContain('PREDATOR_PREY_IMBALANCE');
    expect(insightKinds).toContain('DECOMPOSITION_BACKLOG');
    expect(insightKinds).toContain('ENVIRONMENTAL_STRESS');
    expect(insights.find((insight) => insight.kind === 'COLLAPSE_RISK')?.severity).toBe('CRITICAL');
  });

  it('returns no insights when history is empty', () => {
    expect(buildInsights([], calculateAggregate([]), [], [])).toEqual([]);
  });
});
