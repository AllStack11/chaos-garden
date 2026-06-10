import type { Entity } from '@chaos-garden/shared';
import type { EventLogger } from '../../../logging/event-logger';
import type { ApplicationLogger } from '../../../logging/application-logger';
import {
  generateRandomPositionInGarden,
  willRandomEventOccur
} from '../../environment/helpers';
import { createNewPlantEntity } from '../../creatures/plants';

// Higher probability than other wild spawners — plants are the ecosystem foundation
// and need to recover before anything else can.
const WILD_PLANT_SPAWN_PROBABILITY = 0.15;

// Spawn a small cluster so seeds don't all get eaten before any can reproduce.
const WILD_PLANT_CLUSTER_SIZE = 3;

// Trigger below this threshold, not just at zero, to prevent the ecosystem from
// reaching a state where plants are too sparse to recover on their own.
const MIN_PLANT_COUNT = 5;

export async function maybeSpawnWildPlants(
  gardenStateId: number,
  currentPlantCount: number,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<Entity[]> {
  if (currentPlantCount >= MIN_PLANT_COUNT) return [];
  if (!willRandomEventOccur(WILD_PLANT_SPAWN_PROBABILITY)) return [];

  const spawned: Entity[] = [];
  for (let i = 0; i < WILD_PLANT_CLUSTER_SIZE; i++) {
    const position = generateRandomPositionInGarden();
    const plant = createNewPlantEntity(position, gardenStateId, undefined, 'wild', 0, 'wild-seed');
    if (plant.type !== 'plant') continue;
    spawned.push(plant);
    await eventLogger.logBirth(plant, 'wild', 'wild');
  }

  if (spawned.length > 0) {
    await appLogger.info('wild_plant_spawn', `${spawned.length} wild seeds germinated in the barren garden`, {
      count: spawned.length
    });
  }

  return spawned;
}
