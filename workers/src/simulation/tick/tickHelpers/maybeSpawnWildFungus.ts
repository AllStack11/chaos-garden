import type { Entity } from '@chaos-garden/shared';
import type { EventLogger } from '../../../logging/event-logger';
import type { ApplicationLogger } from '../../../logging/application-logger';
import {
  generateRandomPositionInGarden,
  willRandomEventOccur
} from '../../environment/helpers';
import { createNewFungusEntity } from '../../creatures/fungi';

const WILD_FUNGUS_SPAWN_PROBABILITY = 0.10;

// Spawn a pair so decomposition can begin immediately even if one dies early.
const WILD_FUNGUS_GROUP_SIZE = 2;

const MIN_FUNGUS_COUNT = 3;

export async function maybeSpawnWildFungus(
  gardenStateId: number,
  currentFungusCount: number,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<Entity[]> {
  if (currentFungusCount >= MIN_FUNGUS_COUNT) return [];
  if (!willRandomEventOccur(WILD_FUNGUS_SPAWN_PROBABILITY)) return [];

  const spawned: Entity[] = [];
  for (let i = 0; i < WILD_FUNGUS_GROUP_SIZE; i++) {
    const position = generateRandomPositionInGarden();
    const fungus = createNewFungusEntity(position, gardenStateId, undefined, 'wild', 0, 'wild-spore');
    if (fungus.type !== 'fungus') continue;
    spawned.push(fungus);
    await eventLogger.logBirth(fungus, 'wild', 'wild');
  }

  if (spawned.length > 0) {
    await appLogger.info('wild_fungus_spawn', `${spawned.length} wild fungus spores germinated`, {
      count: spawned.length
    });
  }

  return spawned;
}
