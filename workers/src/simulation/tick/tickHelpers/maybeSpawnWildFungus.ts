import type { Entity } from '@chaos-garden/shared';
import type { EventLogger } from '../../../logging/event-logger';
import type { ApplicationLogger } from '../../../logging/application-logger';
import {
  generateRandomPositionInGarden,
  willRandomEventOccur
} from '../../environment/helpers';
import { createNewFungusEntity } from '../../creatures/fungi';

const WILD_FUNGUS_SPAWN_PROBABILITY = 0.006;

export async function maybeSpawnWildFungus(
  gardenStateId: number,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<Entity | null> {
  if (!willRandomEventOccur(WILD_FUNGUS_SPAWN_PROBABILITY)) {
    return null;
  }

  const position = generateRandomPositionInGarden();
  const fungus = createNewFungusEntity(position, gardenStateId, undefined, 'wild', 0, 'wild-spore');
  if (fungus.type !== 'fungus') {
    return null;
  }

  await eventLogger.logBirth(fungus, 'wild', 'wild');
  await appLogger.debug('wild_fungus_spawn', 'A wild fungus spore germinated', {
    positionX: position.x,
    positionY: position.y,
    reproductionRate: fungus.reproductionRate,
    decompositionRate: fungus.decompositionRate
  });

  return fungus;
}
