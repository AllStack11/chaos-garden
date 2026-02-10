import type { PopulationSummary } from '@chaos-garden/shared';
import type { EventLogger } from '../../../logging/event-logger';
import { generateNarrativePopulationDeltaDescription } from '../../../logging/event-description-templates';

export async function logPopulationChanges(
  tickNumber: number,
  previous: PopulationSummary,
  current: PopulationSummary,
  eventLogger: EventLogger
): Promise<void> {
  if (previous.plants > 0 && current.plants === 0) {
    await eventLogger.logExtinction('plants', 'plant');
  }
  if (previous.herbivores > 0 && current.herbivores === 0) {
    await eventLogger.logExtinction('herbivores', 'herbivore');
  }
  if (previous.carnivores > 0 && current.carnivores === 0) {
    await eventLogger.logExtinction('carnivores', 'carnivore');
  }

  if (current.total < 10 && previous.total >= 10) {
    await eventLogger.logEcosystemCollapse(current.total);
  }

  const checkExplosion = (
    type: 'plant' | 'herbivore' | 'carnivore',
    previousCount: number,
    currentCount: number
  ) => {
    if (previousCount > 0 && currentCount >= previousCount * 3) {
      return eventLogger.logPopulationExplosion(type, currentCount);
    }
    return Promise.resolve();
  };

  await checkExplosion('plant', previous.plants, current.plants);
  await checkExplosion('herbivore', previous.herbivores, current.herbivores);
  await checkExplosion('carnivore', previous.carnivores, current.carnivores);

  const plantDelta = current.plants - previous.plants;
  const herbivoreDelta = current.herbivores - previous.herbivores;

  if (Math.abs(plantDelta) > 5 || Math.abs(herbivoreDelta) > 2) {
    const deltaDescription = generateNarrativePopulationDeltaDescription(plantDelta, herbivoreDelta);
    await eventLogger.logCustom(
      'POPULATION_DELTA',
      deltaDescription,
      [],
      'LOW',
      ['ecology', 'population', 'delta'],
      { tickNumber, plantDelta, herbivoreDelta, total: current.total }
    );
  }
}
