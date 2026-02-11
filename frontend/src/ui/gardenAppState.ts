import type { Entity, GardenState, HealthStatus, SimulationEvent } from '../env.d.ts';

export interface GardenAppState {
  gardenState: GardenState | null;
  entities: Entity[];
  selectedEntity: Entity | null;
  recentEvents: SimulationEvent[];
  isLoading: boolean;
  health: HealthStatus | null;
  lastTickTime: Date | null;
  hasLoadedOnce: boolean;
  isStatsOverlayOpen: boolean;
  isJournalOverlayOpen: boolean;
}
