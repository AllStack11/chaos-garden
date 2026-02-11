import type { Entity } from '../env.d.ts';

export const DEFAULT_TICK_INTERVAL_MINUTES = 15;
export const TICK_INTERVAL_MS = DEFAULT_TICK_INTERVAL_MINUTES * 60 * 1000;
export const REFRESH_INTERVAL_MS = TICK_INTERVAL_MS;
export const HEALTH_INTERVAL_MS = 60000;
export const STATS_AUTO_REFRESH_MS = TICK_INTERVAL_MS;
export const COUNTDOWN_GRACE_MS = 60000;

export const ENTITY_ICON_BY_TYPE: Record<Entity['type'], string> = {
  plant: '🌿',
  herbivore: '🦌',
  carnivore: '🐺',
  fungus: '🍄',
};
