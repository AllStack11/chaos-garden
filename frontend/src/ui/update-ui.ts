import type { Entity, GardenState, SimulationEvent } from '../env.d.ts';
import { ENTITY_ICON_BY_TYPE } from '../constants/ui';
import { positionSelectionTooltip } from './selectionPosition';
import type { GardenAppState } from './gardenAppState';

interface UpdateUIOptions {
  isMobileUi: boolean;
}

export function updateGardenUI(root: HTMLElement, state: GardenAppState, options: UpdateUIOptions) {
  updatePopulation(root, state.gardenState);
  updateCanvas(root, state);
  updateNarrativeAndJournal(root, state.recentEvents);
  updateLoading(root, state.isLoading);
  updateSelectionTooltip(root, state, options.isMobileUi);
  updateStatsPanel(root, state.gardenState);
  updateLastUpdateTime(root);
}

function updatePopulation(root: HTMLElement, gardenState: GardenState | null) {
  const popEl = root.ownerDocument?.getElementById('global-population');
  if (popEl && gardenState) {
    popEl.innerHTML = `${gardenState.populationSummary.totalLiving} <span class="text-[9px] opacity-40 ml-1 uppercase">Living</span>`;
  }
}

function updateCanvas(root: HTMLElement, state: GardenAppState) {
  const canvas = root.querySelector('garden-canvas') as {
    updateState?: (
      entities: Entity[],
      selected: Entity | null,
      gardenState: GardenState | null,
      events: SimulationEvent[],
    ) => void;
    getEntityCanvasPosition?: (entity: Entity | null) => { x: number; y: number } | null;
  };

  if (canvas && typeof canvas.updateState === 'function') {
    canvas.updateState(state.entities, state.selectedEntity, state.gardenState, state.recentEvents);
  }
}

function updateNarrativeAndJournal(root: HTMLElement, events: SimulationEvent[]) {
  const narrativeTicker = root.querySelector('narrative-ticker') as HTMLElement & {
    updateNarrativeEvents?: (events: SimulationEvent[]) => void;
  };
  if (narrativeTicker?.updateNarrativeEvents) {
    narrativeTicker.updateNarrativeEvents(events);
  }

  const journalOverlay = root.querySelector('journal-overlay') as HTMLElement & {
    setEvents?: (events: SimulationEvent[]) => void;
  };
  if (journalOverlay?.setEvents) {
    journalOverlay.setEvents(events);
  }
}

function updateLoading(root: HTMLElement, isLoading: boolean) {
  const loading = root.querySelector('[data-loading]') as HTMLElement | null;
  if (loading) loading.classList.toggle('hidden', !isLoading);
}

function updateSelectionTooltip(root: HTMLElement, state: GardenAppState, isMobileUi: boolean) {
  const selectionInfo = root.querySelector('[data-selection-info]') as HTMLElement | null;
  if (!selectionInfo) return;

  selectionInfo.classList.toggle('hidden', !state.selectedEntity);
  if (!state.selectedEntity) return;

  const entity = state.selectedEntity;
  const nameEl = root.querySelector('[data-selection-name]');
  const speciesEl = root.querySelector('[data-selection-species]');
  const statsEl = root.querySelector('[data-selection-stats]');
  const iconEl = root.querySelector('[data-selection-icon]');

  const healthBar = root.querySelector('[data-selection-health-bar]') as HTMLElement | null;
  const healthText = root.querySelector('[data-selection-health-text]');
  const energyBar = root.querySelector('[data-selection-energy-bar]') as HTMLElement | null;
  const energyText = root.querySelector('[data-selection-energy-text]');

  if (nameEl) nameEl.textContent = entity.name;
  if (speciesEl) speciesEl.textContent = entity.species;
  if (statsEl) statsEl.textContent = `Age ${entity.age} • Evol Ticks`;
  if (iconEl) iconEl.textContent = ENTITY_ICON_BY_TYPE[entity.type] || '❓';

  if (healthBar) {
    healthBar.style.width = `${entity.health}%`;
    healthBar.className = `h-full transition-all duration-500 ${
      entity.health > 60 ? 'bg-green-400' : entity.health > 30 ? 'bg-yellow-400' : 'bg-red-400'
    }`;
  }
  if (healthText) healthText.textContent = `${Math.round(entity.health)}%`;

  if (energyBar) {
    energyBar.style.width = `${entity.energy}%`;
  }
  if (energyText) energyText.textContent = `${Math.round(entity.energy)}%`;

  const canvas = root.querySelector('garden-canvas') as {
    getEntityCanvasPosition?: (entity: Entity | null) => { x: number; y: number } | null;
  } | null;
  if (canvas?.getEntityCanvasPosition) {
    const pos = canvas.getEntityCanvasPosition(state.selectedEntity);
    if (pos) {
      positionSelectionTooltip(selectionInfo, pos, isMobileUi);
    }
  }
}

function updateStatsPanel(root: HTMLElement, gardenState: GardenState | null) {
  const statsPanel = root.querySelector('stats-panel') as {
    updateState?: (gardenState: GardenState) => void;
  } | null;
  if (statsPanel && gardenState && typeof statsPanel.updateState === 'function') {
    statsPanel.updateState(gardenState);
  }
}

function updateLastUpdateTime(root: HTMLElement) {
  const lastUpdate = root.querySelector('[data-last-update]') as HTMLElement | null;
  if (lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString();
}
