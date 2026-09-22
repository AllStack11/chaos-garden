/**
 * Chaos Garden - Reactive Garden State (Svelte 5 Runes)
 *
 * Manages live ecosystem telemetry, simulation speeds, and selected entity vitals.
 * Fully decoupled from the 60 FPS render loop; updates only via 4-10 Hz TelemetryPulse.
 */

import type { SelectedEntityVitals, TelemetryPulse } from '../worker/types.js';
import type { SelectedEntityVitals, TelemetryPulse, BootstrapContinuationMode } from '../worker/types.js';

export class GardenState {
  tick = $state(0);
  tps = $state(60);
  targetTps = $state(60);
  speedMultiplier = $state(1.0); // 0 = paused, 0.5, 1, 2, 5, 10
  isPaused = $derived(this.speedMultiplier === 0);
  bootstrapMode = $state<BootstrapContinuationMode | null>(null);

  populations = $state({
    plants: 0,
    herbivores: 0,
    carnivores: 0,
    fungi: 0,
    totalLiving: 0,
    totalBiomass: 0,
  });

  // Derived population percentages for HUD breakdown bars
  plantRatio = $derived(
    this.populations.totalLiving > 0
      ? this.populations.plants / this.populations.totalLiving
      : 0,
  );

  herbivoreRatio = $derived(
    this.populations.totalLiving > 0
      ? this.populations.herbivores / this.populations.totalLiving
      : 0,
  );

  carnivoreRatio = $derived(
    this.populations.totalLiving > 0
      ? this.populations.carnivores / this.populations.totalLiving
      : 0,
  );

  fungusRatio = $derived(
    this.populations.totalLiving > 0
      ? this.populations.fungi / this.populations.totalLiving
      : 0,
  );

  selectedEntity = $state<SelectedEntityVitals | null>(null);

  updateFromTelemetry(pulse: TelemetryPulse): void {
    this.tick = pulse.tick;
    this.tps = pulse.tps;
    this.populations = pulse.populations;
    if (pulse.selectedEntityVitals !== undefined) {
      this.selectedEntity = pulse.selectedEntityVitals;
    }
  }

  setSpeed(speed: number): void {
    this.speedMultiplier = Math.max(0, speed);
  }

  togglePause(): void {
    if (this.speedMultiplier === 0) {
      this.speedMultiplier = 1.0;
    } else {
      this.speedMultiplier = 0;
    }
  }
}

export const gardenState = new GardenState();

