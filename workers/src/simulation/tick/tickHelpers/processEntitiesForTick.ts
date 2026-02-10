import type { Entity, Environment } from '@chaos-garden/shared';
import type { EventLogger } from '../../../logging/event-logger';
import type { ApplicationLogger } from '../../../logging/application-logger';
import {
  processPlantBehaviorDuringTick,
  isPlantDead,
  getPlantCauseOfDeath
} from '../../creatures/plants';
import {
  processHerbivoreBehaviorDuringTick,
  isHerbivoreDead,
  getHerbivoreCauseOfDeath
} from '../../creatures/herbivores';
import {
  processCarnivoreBehaviorDuringTick,
  isCarnivoreDead,
  getCarnivoreCauseOfDeath
} from '../../creatures/carnivores';
import {
  processFungusBehaviorDuringTick,
  isFungusDead,
  getFungusCauseOfDeath
} from '../../creatures/fungi';

export interface ProcessEntitiesForTickResult {
  newEntities: Entity[];
  consumedPlantIds: string[];
  decomposedEntityIds: string[];
  updatedDeadEntities: Entity[];
}

export async function processEntitiesForTick(
  entities: Entity[],
  decomposableDeadEntities: Entity[],
  environment: Environment,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<ProcessEntitiesForTickResult> {
  const newEntities: Entity[] = [];
  const consumedPlantIds: string[] = [];
  const decomposedEntityIds: string[] = [];

  // Separate entities by type
  const plants = entities.filter(e => e.type === 'plant');
  const herbivores = entities.filter(e => e.type === 'herbivore');
  const carnivores = entities.filter(e => e.type === 'carnivore');
  const fungi = entities.filter(e => e.type === 'fungus');

  // Process plants first (they create energy)
  for (const plant of plants) {
    const offspring = await processPlantBehaviorDuringTick(plant, environment, eventLogger);
    for (const child of offspring) {
      child.lineage = plant.id;
    }
    newEntities.push(...offspring);

    if (isPlantDead(plant)) {
      await appLogger.debug('plant_death', `Plant ${plant.id.substring(0, 8)} died`, {
        plantId: plant.id,
        age: plant.age,
        energy: plant.energy,
        health: plant.health,
        cause: getPlantCauseOfDeath(plant)
      });
    }
  }

  // Process herbivores (they consume plants)
  for (const herbivore of herbivores) {
    const result = await processHerbivoreBehaviorDuringTick(herbivore, environment, plants, eventLogger);
    for (const child of result.offspring) {
      child.lineage = herbivore.id;
    }
    newEntities.push(...result.offspring);
    consumedPlantIds.push(...result.consumed);

    if (isHerbivoreDead(herbivore)) {
      await appLogger.debug('herbivore_death', `Herbivore ${herbivore.id.substring(0, 8)} died`, {
        herbivoreId: herbivore.id,
        age: herbivore.age,
        energy: herbivore.energy,
        health: herbivore.health,
        cause: getHerbivoreCauseOfDeath(herbivore)
      });
    }
  }

  // Process carnivores (they hunt herbivores)
  for (const carnivore of carnivores) {
    const result = await processCarnivoreBehaviorDuringTick(carnivore, environment, herbivores, eventLogger);
    for (const child of result.offspring) {
      child.lineage = carnivore.id;
    }
    newEntities.push(...result.offspring);

    if (isCarnivoreDead(carnivore)) {
      await appLogger.debug('carnivore_death', `Carnivore ${carnivore.id.substring(0, 8)} died`, {
        carnivoreId: carnivore.id,
        age: carnivore.age,
        energy: carnivore.energy,
        health: carnivore.health,
        cause: getCarnivoreCauseOfDeath(carnivore)
      });
    }
  }

  // Process fungi (they decompose dead matter)
  for (const fungus of fungi) {
    const result = await processFungusBehaviorDuringTick(
      fungus,
      environment,
      [...entities, ...decomposableDeadEntities],
      eventLogger
    );
    for (const child of result.offspring) {
      child.lineage = fungus.id;
    }
    newEntities.push(...result.offspring);
    decomposedEntityIds.push(...result.decomposed);

    if (isFungusDead(fungus)) {
      await appLogger.debug('fungus_death', `Fungus ${fungus.id.substring(0, 8)} died`, {
        fungusId: fungus.id,
        age: fungus.age,
        energy: fungus.energy,
        health: fungus.health,
        cause: getFungusCauseOfDeath(fungus)
      });
    }
  }

  const decomposedEntityIdsSet = new Set(decomposedEntityIds);
  const updatedDeadEntities = decomposableDeadEntities.filter(entity =>
    decomposedEntityIdsSet.has(entity.id)
  );

  return { newEntities, consumedPlantIds, decomposedEntityIds, updatedDeadEntities };
}
