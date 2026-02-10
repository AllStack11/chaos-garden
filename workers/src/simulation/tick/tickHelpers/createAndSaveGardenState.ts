import type { Environment, GardenState, PopulationSummary } from '@chaos-garden/shared';
import type { ApplicationLogger } from '../../../logging/application-logger';
import type { D1Database } from '../../../types/worker';
import { createTimestamp } from '../../environment/helpers';
import { saveGardenStateToDatabase } from '../../../db/queries';

export async function createAndSaveGardenState(
  db: D1Database,
  tickNumber: number,
  environment: Environment,
  populationSummary: PopulationSummary,
  appLogger: ApplicationLogger
): Promise<GardenState> {
  const gardenState: Omit<GardenState, 'id'> = {
    tick: tickNumber,
    timestamp: createTimestamp(),
    environment,
    populationSummary
  };

  const stateId = await saveGardenStateToDatabase(db, gardenState as GardenState);
  await appLogger.debug('state_saved', `Garden state saved with ID ${stateId}`, {
    tick: tickNumber,
    stateId
  });

  return {
    ...gardenState,
    id: stateId
  } as GardenState;
}
