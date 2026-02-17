import type {
  Entity,
  EventSeverityBreakdown,
  EventTypeBreakdown,
  GardenEntityVitals,
  GardenInsight,
  GardenState,
  GardenStatsAggregate,
  GardenStatsPoint,
  GardenTypeVitalSummary,
} from '@chaos-garden/shared';

function getSlope(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  return (values[values.length - 1] - values[0]) / (values.length - 1);
}

function getVolatility(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function roundMetric(value: number, decimalPlaces: number = 4): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

function calculateBiodiversityIndex(point: GardenStatsPoint): number {
  const speciesCounts = [
    point.populations.plants,
    point.populations.herbivores,
    point.populations.carnivores,
    point.populations.fungi,
  ];
  const totalLiving = Math.max(1, point.populations.living);
  let index = 0;

  for (const count of speciesCounts) {
    if (count <= 0) {
      continue;
    }
    const proportion = count / totalLiving;
    index += -(proportion * Math.log(proportion));
  }

  return roundMetric(index, 5);
}

export function toGardenStatsPoint(gardenState: GardenState | null): GardenStatsPoint | null {
  if (!gardenState) {
    return null;
  }

  return {
    tick: gardenState.tick,
    timestamp: gardenState.timestamp,
    populations: {
      plants: gardenState.populationSummary.plants,
      herbivores: gardenState.populationSummary.herbivores,
      carnivores: gardenState.populationSummary.carnivores,
      fungi: gardenState.populationSummary.fungi,
      living: gardenState.populationSummary.totalLiving,
      dead: gardenState.populationSummary.totalDead,
    },
    environment: {
      temperature: gardenState.environment.temperature,
      sunlight: gardenState.environment.sunlight,
      moisture: gardenState.environment.moisture,
      weatherState: gardenState.environment.weatherState?.currentState ?? null,
    },
  };
}

export function calculateAggregate(history: GardenStatsPoint[]): GardenStatsAggregate {
  if (history.length === 0) {
    return {
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
    };
  }

  const firstPoint = history[0];
  const lastPoint = history[history.length - 1];
  const tickSpan = Math.max(1, lastPoint.tick - firstPoint.tick);

  const livingValues = history.map((point) => point.populations.living);
  const deadValues = history.map((point) => point.populations.dead);
  const temperatureValues = history.map((point) => point.environment.temperature);
  const sunlightValues = history.map((point) => point.environment.sunlight);
  const moistureValues = history.map((point) => point.environment.moisture);

  const averageEnvironment = {
    temperature: roundMetric(temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length),
    sunlight: roundMetric(sunlightValues.reduce((sum, value) => sum + value, 0) / sunlightValues.length),
    moisture: roundMetric(moistureValues.reduce((sum, value) => sum + value, 0) / moistureValues.length),
  };

  return {
    tickSpan,
    deltas: {
      plants: lastPoint.populations.plants - firstPoint.populations.plants,
      herbivores: lastPoint.populations.herbivores - firstPoint.populations.herbivores,
      carnivores: lastPoint.populations.carnivores - firstPoint.populations.carnivores,
      fungi: lastPoint.populations.fungi - firstPoint.populations.fungi,
      living: lastPoint.populations.living - firstPoint.populations.living,
      dead: lastPoint.populations.dead - firstPoint.populations.dead,
    },
    growthRates: {
      livingPerTick: roundMetric((lastPoint.populations.living - firstPoint.populations.living) / tickSpan),
      deadPerTick: roundMetric((lastPoint.populations.dead - firstPoint.populations.dead) / tickSpan),
    },
    mortalityPressure: roundMetric(lastPoint.populations.dead / Math.max(1, lastPoint.populations.living)),
    populationVolatility: roundMetric(getVolatility(livingValues)),
    biodiversityIndex: calculateBiodiversityIndex(lastPoint),
    predatorPreyRatio: roundMetric(lastPoint.populations.carnivores / Math.max(1, lastPoint.populations.herbivores)),
    decompositionPressure: roundMetric(lastPoint.populations.dead / Math.max(1, lastPoint.populations.fungi)),
    averageEnvironment,
    trendSlopes: {
      temperature: roundMetric(getSlope(temperatureValues)),
      sunlight: roundMetric(getSlope(sunlightValues)),
      moisture: roundMetric(getSlope(moistureValues)),
    },
  };
}

function buildTypeVitals(entities: Entity[], entityType: Entity['type']): GardenTypeVitalSummary {
  const matchingEntities = entities.filter((entity) => entity.type === entityType);
  if (matchingEntities.length === 0) {
    return { count: 0, averageEnergy: 0, averageHealth: 0 };
  }

  const averageEnergy = matchingEntities.reduce((sum, entity) => sum + entity.energy, 0) / matchingEntities.length;
  const averageHealth = matchingEntities.reduce((sum, entity) => sum + entity.health, 0) / matchingEntities.length;

  return {
    count: matchingEntities.length,
    averageEnergy: roundMetric(averageEnergy),
    averageHealth: roundMetric(averageHealth),
  };
}

export function calculateEntityVitals(livingEntities: Entity[]): GardenEntityVitals {
  if (livingEntities.length === 0) {
    return {
      totalLiving: 0,
      oldestLivingAge: 0,
      youngestLivingAge: 0,
      youngestCohortCount: 0,
      averageEnergyAcrossLiving: 0,
      averageHealthAcrossLiving: 0,
      byType: {
        plant: { count: 0, averageEnergy: 0, averageHealth: 0 },
        herbivore: { count: 0, averageEnergy: 0, averageHealth: 0 },
        carnivore: { count: 0, averageEnergy: 0, averageHealth: 0 },
        fungus: { count: 0, averageEnergy: 0, averageHealth: 0 },
      },
    };
  }

  const oldestLivingAge = Math.max(...livingEntities.map((entity) => entity.age));
  const youngestLivingAge = Math.min(...livingEntities.map((entity) => entity.age));
  const youngestThresholdAge = youngestLivingAge + 10;
  const youngestCohortCount = livingEntities.filter((entity) => entity.age <= youngestThresholdAge).length;

  return {
    totalLiving: livingEntities.length,
    oldestLivingAge,
    youngestLivingAge,
    youngestCohortCount,
    averageEnergyAcrossLiving: roundMetric(
      livingEntities.reduce((sum, entity) => sum + entity.energy, 0) / livingEntities.length
    ),
    averageHealthAcrossLiving: roundMetric(
      livingEntities.reduce((sum, entity) => sum + entity.health, 0) / livingEntities.length
    ),
    byType: {
      plant: buildTypeVitals(livingEntities, 'plant'),
      herbivore: buildTypeVitals(livingEntities, 'herbivore'),
      carnivore: buildTypeVitals(livingEntities, 'carnivore'),
      fungus: buildTypeVitals(livingEntities, 'fungus'),
    },
  };
}

export function buildInsights(
  history: GardenStatsPoint[],
  aggregate: GardenStatsAggregate,
  eventBreakdown: EventTypeBreakdown[],
  severityBreakdown: EventSeverityBreakdown[]
): GardenInsight[] {
  if (history.length === 0) {
    return [];
  }

  const lastPoint = history[history.length - 1];
  const firstPoint = history[0];
  const tickRange = { start: firstPoint.tick, end: lastPoint.tick };
  const insights: GardenInsight[] = [];
  const severeEvents = severityBreakdown.find((item) => item.severity === 'CRITICAL')?.count ?? 0;
  const deathEvents = eventBreakdown.find((item) => item.eventType === 'DEATH')?.count ?? 0;

  if (aggregate.growthRates.livingPerTick > 0.7) {
    insights.push({
      id: 'population-surge',
      title: 'Population surge detected',
      description: 'Living population is rising rapidly over the active window.',
      severity: 'MEDIUM',
      kind: 'POPULATION_SURGE',
      confidence: 0.82,
      relatedMetrics: ['growthRates.livingPerTick', 'deltas.living'],
      tickRange,
    });
  }

  if (aggregate.growthRates.livingPerTick < -0.4 || aggregate.mortalityPressure > 0.45 || severeEvents > 0) {
    insights.push({
      id: 'collapse-risk',
      title: 'Collapse risk emerging',
      description: 'Mortality pressure and negative living growth indicate instability risk.',
      severity: severeEvents > 0 ? 'CRITICAL' : 'HIGH',
      kind: 'COLLAPSE_RISK',
      confidence: severeEvents > 0 ? 0.92 : 0.78,
      relatedMetrics: ['mortalityPressure', 'growthRates.livingPerTick'],
      tickRange,
    });
  }

  if (aggregate.predatorPreyRatio > 0.9 || aggregate.predatorPreyRatio < 0.08) {
    insights.push({
      id: 'predator-prey-imbalance',
      title: 'Predator-prey imbalance',
      description: 'Carnivore and herbivore populations have diverged beyond stable bounds.',
      severity: aggregate.predatorPreyRatio > 1.2 ? 'HIGH' : 'MEDIUM',
      kind: 'PREDATOR_PREY_IMBALANCE',
      confidence: 0.8,
      relatedMetrics: ['predatorPreyRatio'],
      tickRange,
    });
  }

  if (aggregate.decompositionPressure > 4 || (aggregate.deltas.dead > 0 && aggregate.deltas.fungi <= 0)) {
    insights.push({
      id: 'decomposition-backlog',
      title: 'Decomposition backlog',
      description: 'Dead matter accumulation is outpacing fungal decomposition capacity.',
      severity: 'MEDIUM',
      kind: 'DECOMPOSITION_BACKLOG',
      confidence: 0.74,
      relatedMetrics: ['decompositionPressure', 'deltas.dead', 'deltas.fungi'],
      tickRange,
    });
  }

  if ((aggregate.averageEnvironment.moisture < 0.26 || aggregate.averageEnvironment.sunlight < 0.22) && deathEvents > 0) {
    insights.push({
      id: 'environmental-stress',
      title: 'Environmental stress pattern',
      description: 'Sustained low resources are correlated with mortality events in this window.',
      severity: 'HIGH',
      kind: 'ENVIRONMENTAL_STRESS',
      confidence: 0.77,
      relatedMetrics: ['averageEnvironment.moisture', 'averageEnvironment.sunlight'],
      tickRange,
    });
  }

  if (aggregate.populationVolatility < 4 && aggregate.biodiversityIndex > 1.1 && aggregate.mortalityPressure < 0.2) {
    insights.push({
      id: 'stability-window',
      title: 'Stability window',
      description: 'Population volatility is low while biodiversity and survivability remain healthy.',
      severity: 'LOW',
      kind: 'STABILITY_WINDOW',
      confidence: 0.86,
      relatedMetrics: ['populationVolatility', 'biodiversityIndex', 'mortalityPressure'],
      tickRange,
    });
  }

  return insights;
}
