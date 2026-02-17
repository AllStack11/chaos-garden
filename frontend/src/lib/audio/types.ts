import type { GardenState, SimulationEvent } from '../../env.d.ts';
import type { WeatherStateName } from '@chaos-garden/shared';

export interface SoundscapeInput {
  gardenState: GardenState | null;
  recentEvents: SimulationEvent[];
  nowMs?: number;
}

export interface SoundscapeLayerTargets {
  windLevel: number;
  windFilterHz: number;
  droneLevel: number;
  droneFilterHz: number;
  droneFrequencyHz: number;
  biophonyLevel: number;
  biophonyPulseRateHz: number;
  tensionLevel: number;
  tensionFilterHz: number;
}

export interface DerivedSoundscapeState {
  weather: WeatherStateName;
  sunlight: number;
  dayNightBlend: number;
  populationTension: number;
  biodiversity: number;
  eventIntensity: number;
  layerTargets: SoundscapeLayerTargets;
}

export interface SoundscapeEventAccent {
  type:
    | 'BIRTH'
    | 'DEATH'
    | 'MUTATION'
    | 'EXTINCTION'
    | 'POPULATION_EXPLOSION'
    | 'ECOSYSTEM_COLLAPSE';
  intensity: number;
}

export interface SoundscapeUiState {
  isSupported: boolean;
  muted: boolean;
  volume: number;
  userEnabled: boolean;
}
