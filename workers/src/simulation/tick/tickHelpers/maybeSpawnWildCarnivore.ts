import type { Entity } from '@chaos-garden/shared';
import type { EventLogger } from '../../../logging/event-logger';
import type { ApplicationLogger } from '../../../logging/application-logger';
import {
  generateRandomPositionInGarden,
  willRandomEventOccur
} from '../../environment/helpers';
import { createNewCarnivoreEntity } from '../../creatures/carnivores';

// Only attempt a respawn when carnivores are fully extinct.
const WILD_CARNIVORE_SPAWN_PROBABILITY = 0.05;

// Refuse to spawn a carnivore into an ecosystem that can't support it.
const MIN_HERBIVORES_FOR_SPAWN = 5;

export async function maybeSpawnWildCarnivore(
  gardenStateId: number,
  currentCarnivoreCount: number,
  currentHerbivoreCount: number,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<Entity | null> {
  if (currentCarnivoreCount > 0) return null;
  if (currentHerbivoreCount < MIN_HERBIVORES_FOR_SPAWN) return null;
  if (!willRandomEventOccur(WILD_CARNIVORE_SPAWN_PROBABILITY)) return null;

  const position = generateRandomPositionInGarden();
  const carnivore = createNewCarnivoreEntity(position, gardenStateId, undefined, 'wild', 0, 'wild-predator');
  if (carnivore.type !== 'carnivore') return null;

  await eventLogger.logBirth(carnivore, 'wild', 'wild');
  await appLogger.info('wild_carnivore_spawn', 'A wild carnivore emerged from beyond the garden', {
    positionX: position.x,
    positionY: position.y,
    movementSpeed: carnivore.movementSpeed,
    perceptionRadius: carnivore.perceptionRadius
  });

  return carnivore;
}
