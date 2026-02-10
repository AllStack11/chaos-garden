import type { Entity, Position } from '@chaos-garden/shared';
import type { EventLogger } from '../../logging/event-logger';
import { generateRandomPositionInGarden } from '../environment/helpers';

type MutationTrackableTrait =
  | 'reproductionRate'
  | 'metabolismEfficiency'
  | 'photosynthesisRate'
  | 'movementSpeed'
  | 'perceptionRadius'
  | 'threatDetectionRadius'
  | 'decompositionRate';

function didTraitMutateEnoughToLog(previousValue: number, nextValue: number): boolean {
  if (previousValue === 0) {
    return nextValue !== 0;
  }

  return Math.abs(nextValue - previousValue) / Math.abs(previousValue) > 0.01;
}

/**
 * Log meaningful trait mutations between parent and offspring entities.
 */
export async function logTraitMutationsForOffspring(
  parent: Entity,
  child: Entity,
  trackedTraits: ReadonlyArray<MutationTrackableTrait>,
  eventLogger: EventLogger
): Promise<void> {
  if (parent.type !== child.type) {
    return;
  }

  const parentTraitValues = parent as Entity & Record<MutationTrackableTrait, number>;
  const childTraitValues = child as Entity & Record<MutationTrackableTrait, number>;

  for (const trait of trackedTraits) {
    const oldValue = parentTraitValues[trait];
    const newValue = childTraitValues[trait];

    if (didTraitMutateEnoughToLog(oldValue, newValue)) {
      await eventLogger.logMutation(child, trait, oldValue, newValue);
    }
  }
}

/**
 * Shared definition for whether an entity is dead in simulation terms.
 */
export function isEntityDead(entity: Entity): boolean {
  return !entity.isAlive || entity.health <= 0 || entity.energy <= 0;
}

/**
 * Shared death-cause formatter that allows each species to provide its wording.
 */
export function getEntityCauseOfDeath(
  entity: Entity,
  maxAge: number,
  starvationCause: string,
  healthFailureCause: string
): string {
  if (entity.age >= maxAge) return 'died of old age';
  if (entity.energy <= 0) return starvationCause;
  if (entity.health <= 0) return healthFailureCause;
  return 'unknown cause';
}

/**
 * Create a population with random positions for entity types that do not need
 * custom spatial distribution rules.
 */
export function createInitialPopulationWithRandomPositions(
  count: number,
  gardenStateId: number,
  createEntity: (position: Position, gardenStateId: number) => Entity
): Entity[] {
  const entities: Entity[] = [];

  for (let index = 0; index < count; index++) {
    entities.push(createEntity(generateRandomPositionInGarden(), gardenStateId));
  }

  return entities;
}
