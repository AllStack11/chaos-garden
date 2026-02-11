import type { GardenState, HealthStatus } from '../env.d.ts';
import { DEFAULT_TICK_INTERVAL_MINUTES, COUNTDOWN_GRACE_MS } from '../constants/ui';

interface StatusState {
  gardenState: GardenState | null;
  health: HealthStatus | null;
}

export function updateStatusIndicators(root: HTMLElement, state: StatusState) {
  const isHealthy = state.health?.status === 'healthy';
  const dot = root.querySelector('#system-status-dot');
  const subtitle = root.querySelector('#system-status-subtitle');

  if (dot && subtitle) {
    if (isHealthy) {
      dot.className = 'h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)] animate-pulse';
      const currentTick = state.health?.gardenState?.tick ?? state.gardenState?.tick;
      subtitle.textContent = `TICK #${currentTick ?? '?'}`;
    } else {
      dot.className = 'h-1.5 w-1.5 rounded-full bg-red-500';
      subtitle.textContent = 'SYSTEM DISCONNECTED';
    }
  }

  const weatherPanel = root.querySelector('weather-panel') as HTMLElement & {
    updateState?: (gardenState: GardenState | null) => void;
  };
  if (weatherPanel && typeof weatherPanel.updateState === 'function') {
    weatherPanel.updateState(state.gardenState);
  }
}

export function updateCountdownDisplay(
  lastTickTime: Date | null,
  tickIntervalMinutes: number | undefined,
  countdownEl: HTMLElement | null,
) {
  if (!lastTickTime || !countdownEl) return;

  const intervalMs = (tickIntervalMinutes || DEFAULT_TICK_INTERVAL_MINUTES) * 60 * 1000;
  const gracePeriodMs = COUNTDOWN_GRACE_MS;

  const now = new Date().getTime();
  const lastTickMs = lastTickTime.getTime();
  const nextTickMs = lastTickMs + intervalMs;

  const remainingMs = nextTickMs - now;

  if (remainingMs < -gracePeriodMs) {
    countdownEl.textContent = 'Evolving...';
    countdownEl.classList.add('animate-pulse');
    return;
  }

  countdownEl.classList.remove('animate-pulse');

  if (remainingMs < 0) {
    countdownEl.textContent = '00:00';
    return;
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  countdownEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}
