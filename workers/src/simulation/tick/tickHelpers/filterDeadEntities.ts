import type { Entity } from '@chaos-garden/shared';
import { isPlantDead } from '../../creatures/plants';
import { isHerbivoreDead } from '../../creatures/herbivores';
import { isCarnivoreDead } from '../../creatures/carnivores';
import { isFungusDead } from '../../creatures/fungi';

export function filterDeadEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => {
    if (entity.type === 'plant') return isPlantDead(entity);
    if (entity.type === 'herbivore') return isHerbivoreDead(entity);
    if (entity.type === 'carnivore') return isCarnivoreDead(entity);
    if (entity.type === 'fungus') return isFungusDead(entity);
    return false;
  });
}
