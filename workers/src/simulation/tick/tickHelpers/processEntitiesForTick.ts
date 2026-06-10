import type { Entity, DeadMatter, Environment } from '@chaos-garden/shared';
import { DEFAULT_SIMULATION_CONFIG } from '@chaos-garden/shared';
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
  touchedDeadMatter: DeadMatter[];
}

export async function processEntitiesForTick(
  entities: Entity[],
  deadMatter: DeadMatter[],
  environment: Environment,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<ProcessEntitiesForTickResult> {
  const newEntities: Entity[] = [];
  const touchedDeadMatter: DeadMatter[] = [];

  const plants = entities.filter(e => e.type === 'plant');
  const herbivores = entities.filter(e => e.type === 'herbivore');
  const carnivores = entities.filter(e => e.type === 'carnivore');
  const fungi = entities.filter(e => e.type === 'fungus');

  // Running counts to enforce population caps during reproduction.
  let plantCount = plants.length;
  let herbivoreCount = herbivores.length;
  let carnivoreCount = carnivores.length;
  let fungusCount = fungi.length;
  const maxFungi = DEFAULT_SIMULATION_CONFIG.maxTotalEntities
    - DEFAULT_SIMULATION_CONFIG.maxPlants
    - DEFAULT_SIMULATION_CONFIG.maxHerbivores
    - DEFAULT_SIMULATION_CONFIG.maxCarnivores;

  // Carnivores first so predation resolves before prey and plants act.
  for (const carnivore of carnivores) {
    if (isCarnivoreDead(carnivore)) continue;

    const result = await processCarnivoreBehaviorDuringTick(carnivore, environment, entities, eventLogger);
    for (const child of result.offspring) child.lineage = carnivore.id;
    const accepted = result.offspring.filter(() => {
      if (carnivoreCount >= DEFAULT_SIMULATION_CONFIG.maxCarnivores) return false;
      carnivoreCount++;
      return true;
    });
    newEntities.push(...accepted);

    if (isCarnivoreDead(carnivore)) {
      await appLogger.debug('carnivore_death', `Carnivore ${carnivore.id.substring(0, 8)} died`, {
        carnivoreId: carnivore.id, age: carnivore.age, energy: carnivore.energy,
        health: carnivore.health, cause: getCarnivoreCauseOfDeath(carnivore)
      });
    }
  }

  for (const plant of plants) {
    if (isPlantDead(plant)) continue;

    const offspring = await processPlantBehaviorDuringTick(plant, environment, eventLogger);
    for (const child of offspring) child.lineage = plant.id;
    const accepted = offspring.filter(() => {
      if (plantCount >= DEFAULT_SIMULATION_CONFIG.maxPlants) return false;
      plantCount++;
      return true;
    });
    newEntities.push(...accepted);

    if (isPlantDead(plant)) {
      await appLogger.debug('plant_death', `Plant ${plant.id.substring(0, 8)} died`, {
        plantId: plant.id, age: plant.age, energy: plant.energy,
        health: plant.health, cause: getPlantCauseOfDeath(plant)
      });
    }
  }

  for (const herbivore of herbivores) {
    if (isHerbivoreDead(herbivore)) continue;

    const result = await processHerbivoreBehaviorDuringTick(herbivore, environment, entities, eventLogger);
    for (const child of result.offspring) child.lineage = herbivore.id;
    const accepted = result.offspring.filter(() => {
      if (herbivoreCount >= DEFAULT_SIMULATION_CONFIG.maxHerbivores) return false;
      herbivoreCount++;
      return true;
    });
    newEntities.push(...accepted);

    if (isHerbivoreDead(herbivore)) {
      await appLogger.debug('herbivore_death', `Herbivore ${herbivore.id.substring(0, 8)} died`, {
        herbivoreId: herbivore.id, age: herbivore.age, energy: herbivore.energy,
        health: herbivore.health, cause: getHerbivoreCauseOfDeath(herbivore)
      });
    }
  }

  // Fungi receive the dead_matter array. They mutate energy in place;
  // touchedDeadMatter collects all items decomposed (fully or partially) this tick.
  for (const fungus of fungi) {
    if (isFungusDead(fungus)) continue;

    const result = await processFungusBehaviorDuringTick(fungus, environment, deadMatter, eventLogger);
    for (const child of result.offspring) child.lineage = fungus.id;
    const accepted = result.offspring.filter(() => {
      if (fungusCount >= maxFungi) return false;
      fungusCount++;
      return true;
    });
    newEntities.push(...accepted);

    for (const item of result.touchedDeadMatter) {
      if (!touchedDeadMatter.some(t => t.id === item.id)) {
        touchedDeadMatter.push(item);
      }
    }

    if (isFungusDead(fungus)) {
      await appLogger.debug('fungus_death', `Fungus ${fungus.id.substring(0, 8)} died`, {
        fungusId: fungus.id, age: fungus.age, energy: fungus.energy,
        health: fungus.health, cause: getFungusCauseOfDeath(fungus)
      });
    }
  }

  return { newEntities, touchedDeadMatter };
}
