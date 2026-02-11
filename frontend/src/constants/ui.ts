import type { Entity } from '../env.d.ts';

export const REFRESH_INTERVAL_MS = 30000;
export const HEALTH_INTERVAL_MS = 10000;
export const COUNTDOWN_GRACE_MS = 60000;
export const DEFAULT_TICK_INTERVAL_MINUTES = 15;

export const ENTITY_ICON_BY_TYPE: Record<Entity['type'], string> = {
  plant: '🌿',
  herbivore: '🦌',
  carnivore: '🐺',
  fungus: '🍄',
};
