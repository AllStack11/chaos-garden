import type { GardenStatsPoint, GardenStatsResponse } from '@chaos-garden/shared';

export function buildHistoryPoint(tick: number): GardenStatsPoint {
  return {
    tick,
    timestamp: `2026-01-01T00:${tick.toString().padStart(2, '0')}:00.000Z`,
    populations: {
      plants: 15 + tick,
      herbivores: 8 + Math.floor(tick / 2),
      carnivores: 3 + Math.floor(tick / 3),
      fungi: 5 + Math.floor(tick / 4),
      living: 31 + tick,
      dead: 2 + Math.floor(tick / 3),
    },
    environment: {
      temperature: 19 + tick * 0.2,
      sunlight: 0.35 + tick * 0.01,
      moisture: 0.62 - tick * 0.008,
      weatherState: tick % 3 === 0 ? 'RAIN' : tick % 2 === 0 ? 'OVERCAST' : 'CLEAR',
    },
  };
}

export function buildStatsResponse(): GardenStatsResponse {
  const history = [buildHistoryPoint(1), buildHistoryPoint(2), buildHistoryPoint(3), buildHistoryPoint(4)];
  const currentPoint = history[history.length - 1];

  return {
    current: {
      id: 9,
      tick: currentPoint.tick,
      timestamp: currentPoint.timestamp,
      environment: {
        tick: currentPoint.tick,
        temperature: currentPoint.environment.temperature,
        sunlight: currentPoint.environment.sunlight,
        moisture: currentPoint.environment.moisture,
        weatherState: {
          currentState: currentPoint.environment.weatherState ?? 'CLEAR',
          stateEnteredAtTick: 1,
          plannedDurationTicks: 10,
          previousState: 'CLEAR',
          transitionProgressTicks: 0,
        },
      },
      populationSummary: {
        plants: currentPoint.populations.plants,
        herbivores: currentPoint.populations.herbivores,
        carnivores: currentPoint.populations.carnivores,
        fungi: currentPoint.populations.fungi,
        deadPlants: 1,
        deadHerbivores: 1,
        deadCarnivores: 0,
        deadFungi: 0,
        allTimeDeadPlants: 11,
        allTimeDeadHerbivores: 6,
        allTimeDeadCarnivores: 3,
        allTimeDeadFungi: 2,
        total: currentPoint.populations.living + currentPoint.populations.dead,
        totalLiving: currentPoint.populations.living,
        totalDead: currentPoint.populations.dead,
        allTimeDead: 22,
      },
    },
    history,
    eventBreakdown: [
      { eventType: 'BIRTH', count: 5 },
      { eventType: 'DEATH', count: 3 },
    ],
    severityBreakdown: [
      { severity: 'LOW', count: 4 },
      { severity: 'HIGH', count: 2 },
    ],
    derived: {
      tickSpan: 3,
      deltas: {
        plants: 3,
        herbivores: 1,
        carnivores: 1,
        fungi: 1,
        living: 3,
        dead: 1,
      },
      growthRates: {
        livingPerTick: 1,
        deadPerTick: 0.3333,
      },
      mortalityPressure: 0.15,
      populationVolatility: 1.12,
      biodiversityIndex: 1.21,
      predatorPreyRatio: 0.33,
      decompositionPressure: 0.5,
      averageEnvironment: {
        temperature: 20.2,
        sunlight: 0.39,
        moisture: 0.59,
      },
      trendSlopes: {
        temperature: 0.2,
        sunlight: 0.01,
        moisture: -0.008,
      },
    },
    insights: [
      {
        id: 'stability-window',
        title: 'Stability window',
        description: 'Population volatility is low while biodiversity and survivability remain healthy.',
        severity: 'LOW',
        kind: 'STABILITY_WINDOW',
        confidence: 0.86,
        relatedMetrics: ['populationVolatility'],
        tickRange: { start: 1, end: 4 },
      },
    ],
    entityVitals: {
      totalLiving: currentPoint.populations.living,
      oldestLivingAge: 43,
      youngestLivingAge: 2,
      youngestCohortCount: 9,
      averageEnergyAcrossLiving: 58.6,
      averageHealthAcrossLiving: 71.4,
      byType: {
        plant: { count: currentPoint.populations.plants, averageEnergy: 61.2, averageHealth: 88.1 },
        herbivore: { count: currentPoint.populations.herbivores, averageEnergy: 52.4, averageHealth: 63.2 },
        carnivore: { count: currentPoint.populations.carnivores, averageEnergy: 46.3, averageHealth: 59.7 },
        fungus: { count: currentPoint.populations.fungi, averageEnergy: 55.1, averageHealth: 74.8 },
      },
    },
    windowTicks: 120,
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}
