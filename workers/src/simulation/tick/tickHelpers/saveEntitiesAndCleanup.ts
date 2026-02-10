import type { Entity } from '@chaos-garden/shared';
import type { ApplicationLogger } from '../../../logging/application-logger';
import type { D1Database } from '../../../types/worker';
import { markEntitiesAsDeadInDatabase, saveEntitiesToDatabase } from '../../../db/queries';

export async function saveEntitiesAndCleanup(
  db: D1Database,
  gardenStateId: number,
  tickNumber: number,
  newEntities: Entity[],
  deadEntities: Entity[],
  livingEntities: Entity[],
  updatedDeadEntities: Entity[],
  appLogger: ApplicationLogger
): Promise<void> {
  for (const entity of newEntities) {
    entity.bornAtTick = tickNumber;
    entity.gardenStateId = gardenStateId;
  }

  const entitiesToSaveById = new Map<string, Entity>();
  for (const entity of [...newEntities, ...livingEntities, ...deadEntities, ...updatedDeadEntities]) {
    entitiesToSaveById.set(entity.id, entity);
  }
  const entitiesToSave = [...entitiesToSaveById.values()];
  await saveEntitiesToDatabase(db, entitiesToSave);

  await appLogger.debug('entities_saved', `Saved ${entitiesToSave.length} entities at tick ${tickNumber}`, {
    newCount: newEntities.length,
    livingCount: livingEntities.length,
    totalSaved: entitiesToSave.length
  });

  const deadEntityIds = deadEntities.map(e => e.id);
  await markEntitiesAsDeadInDatabase(db, deadEntityIds, tickNumber);
  await appLogger.debug('dead_marked', `Marked ${deadEntities.length} entities as dead`, {
    deadCount: deadEntities.length
  });
}
