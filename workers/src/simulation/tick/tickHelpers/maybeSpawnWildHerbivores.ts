import type { Entity } from '@chaos-garden/shared';
import type { EventLogger } from '../../../logging/event-logger';
import type { ApplicationLogger } from '../../../logging/application-logger';
import {
  generateRandomPositionInGarden,
  willRandomEventOccur
} from '../../environment/helpers';
import { createNewHerbivoreEntity } from '../../creatures/herbivores';

// Only attempt recovery when herbivores are fully extinct.
const WILD_HERBIVORE_SPAWN_PROBABILITY = 0.08;

// Spawn in a small group so at least one survives long enough to reproduce.
const WILD_HERBIVORE_GROUP_SIZE = 2;

// Refuse to introduce herbivores into a garden that can't feed them.
const MIN_PLANTS_FOR_SPAWN = 5;

export async function maybeSpawnWildHerbivores(
  gardenStateId: number,
  currentHerbivoreCount: number,
  currentPlantCount: number,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<Entity[]> {
  if (currentHerbivoreCount > 0) return [];
  if (currentPlantCount < MIN_PLANTS_FOR_SPAWN) return [];
  if (!willRandomEventOccur(WILD_HERBIVORE_SPAWN_PROBABILITY)) return [];

  const spawned: Entity[] = [];
  for (let i = 0; i < WILD_HERBIVORE_GROUP_SIZE; i++) {
    const position = generateRandomPositionInGarden();
    const herbivore = createNewHerbivoreEntity(position, gardenStateId, undefined, 'wild', 0, 'wild-grazer');
    if (herbivore.type !== 'herbivore') continue;
    spawned.push(herbivore);
    await eventLogger.logBirth(herbivore, 'wild', 'wild');
  }

  if (spawned.length > 0) {
    await appLogger.info('wild_herbivore_spawn', `${spawned.length} wild herbivores migrated into the garden`, {
      count: spawned.length,
      plantCount: currentPlantCount
    });
  }

  return spawned;
}
