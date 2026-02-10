import type { Entity } from '@chaos-garden/shared';

export function getCurrentDeadEntitiesInGarden(
  newlyDeadEntities: Entity[],
  existingDeadEntities: Entity[]
): Entity[] {
  const entitiesById = new Map<string, Entity>();
  for (const entity of [...newlyDeadEntities, ...existingDeadEntities]) {
    if (!entity.isAlive && entity.energy > 0) {
      entitiesById.set(entity.id, entity);
    }
  }
  return [...entitiesById.values()];
}
