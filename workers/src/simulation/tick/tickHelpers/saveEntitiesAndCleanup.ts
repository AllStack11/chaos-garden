import type { Entity } from '@chaos-garden/shared';
import type { ApplicationLogger } from '../../../logging/application-logger';
import type { D1Database } from '../../../types/worker';
import { saveEntitiesToDatabase, deleteEntitiesByIdsFromDatabase } from '../../../db/queries';

export async function saveEntitiesAndCleanup(
  db: D1Database,
  gardenStateId: number,
  tickNumber: number,
  newEntities: Entity[],
  deadEntityIds: string[],
  livingEntities: Entity[],
  appLogger: ApplicationLogger
): Promise<void> {
  for (const entity of newEntities) {
    entity.bornAtTick = tickNumber;
    entity.gardenStateId = gardenStateId;
  }

  // Deduplicate by ID in case the same entity appears in multiple arrays.
  const entitiesToSaveById = new Map<string, Entity>();
  for (const entity of [...newEntities, ...livingEntities]) {
    entitiesToSaveById.set(entity.id, entity);
  }
  const entitiesToSave = [...entitiesToSaveById.values()];
  await saveEntitiesToDatabase(db, entitiesToSave);

  // Remove dead entities from the entities table entirely.
  // Their dead_matter rows (if any) are created separately in tick.ts.
  await deleteEntitiesByIdsFromDatabase(db, deadEntityIds);

  await appLogger.debug('entities_saved', `Saved ${entitiesToSave.length} entities, deleted ${deadEntityIds.length} dead at tick ${tickNumber}`, {
    newCount: newEntities.length,
    livingCount: livingEntities.length,
    deletedCount: deadEntityIds.length
  });
}
