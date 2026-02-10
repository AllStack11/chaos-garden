import type { Entity, PopulationSummary } from '@chaos-garden/shared';

export function applyAllTimeDeadSummary(
  nextSummary: PopulationSummary,
  previousSummary: PopulationSummary,
  newlyDeadEntities: Entity[]
): void {
  const newlyDeadByType = {
    plant: 0,
    herbivore: 0,
    carnivore: 0,
    fungus: 0
  };

  for (const deadEntity of newlyDeadEntities) {
    newlyDeadByType[deadEntity.type] += 1;
  }

  nextSummary.allTimeDeadPlants = previousSummary.allTimeDeadPlants + newlyDeadByType.plant;
  nextSummary.allTimeDeadHerbivores = previousSummary.allTimeDeadHerbivores + newlyDeadByType.herbivore;
  nextSummary.allTimeDeadCarnivores = previousSummary.allTimeDeadCarnivores + newlyDeadByType.carnivore;
  nextSummary.allTimeDeadFungi = previousSummary.allTimeDeadFungi + newlyDeadByType.fungus;
  nextSummary.allTimeDead =
    previousSummary.allTimeDead +
    newlyDeadByType.plant +
    newlyDeadByType.herbivore +
    newlyDeadByType.carnivore +
    newlyDeadByType.fungus;
}
