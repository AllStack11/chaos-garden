import type { Entity, SimulationEvent, HealthStatus } from '../env.d.ts';
import { GardenService } from '../services/garden-service';
import { showNotification } from '../ui/notifications';
import { updateGardenUI } from '../ui/update-ui';
import { updateStatusIndicators, updateCountdownDisplay } from '../ui/statusIndicators';
import { REFRESH_INTERVAL_MS, HEALTH_INTERVAL_MS } from '../constants/ui';
import type { GardenAppState } from '../ui/gardenAppState';
import { SoundscapeController } from '../lib/audio/soundscapeController';

export class GardenApp extends HTMLElement {
  private gardenService: GardenService;
  private gardenRefreshTimer: number | null = null;
  private healthCheckTimer: number | null = null;
  private countdownTimer: number | null = null;
  private uiTimeout: number | null = null;
  private gardenRequestInFlight = false;
  private readonly coarsePointerMediaQuery = window.matchMedia('(pointer: coarse)');
  private readonly mobileViewportMediaQuery = window.matchMedia('(max-width: 639px)');
  private soundscapeController: SoundscapeController | null = null;

  private state: GardenAppState = {
    gardenState: null,
    entities: [],
    selectedEntity: null,
    recentEvents: [],
    isLoading: true,
    health: null,
    lastTickTime: null,
    hasLoadedOnce: false,
    isStatsOverlayOpen: false,
    isJournalOverlayOpen: false,
  };

  constructor() {
    super();
    const apiUrl = this.dataset.apiUrl;
    if (!apiUrl) {
      throw new Error('Missing data-api-url on <garden-app>. Set PUBLIC_API_URL in your .env file.');
    }
    this.gardenService = GardenService.getInstance(apiUrl);
    this.setupEventListeners();
  }

  connectedCallback() {
    this.soundscapeController = new SoundscapeController();
    this.soundscapeController.connectUi(this);
    this.loadGardenData();
    this.checkHealth();

    this.gardenRefreshTimer = window.setInterval(() => this.loadGardenData(), REFRESH_INTERVAL_MS);
    this.healthCheckTimer = window.setInterval(() => this.checkHealth(), HEALTH_INTERVAL_MS);
    this.countdownTimer = window.setInterval(() => this.updateCountdown(), 1000);
  }

  disconnectedCallback() {
    if (this.gardenRefreshTimer) {
      clearInterval(this.gardenRefreshTimer);
      this.gardenRefreshTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.uiTimeout) {
      clearTimeout(this.uiTimeout);
      this.uiTimeout = null;
    }
    this.soundscapeController?.dispose();
    this.soundscapeController = null;
    this.teardownEventListeners();
  }

  private readonly handleEntitySelected = (event: Event) => {
    const entitySelectedEvent = event as CustomEvent<Entity | null>;
    this.state.selectedEntity = entitySelectedEvent.detail;
    this.updateUI();
  };

  private readonly handleJournalToggle = () => {
    this.dispatchEvent(new CustomEvent('journal-overlay-open-requested', { bubbles: true, composed: true }));
  };

  private readonly resetUIOverlayOpacity = () => {
    const overlay = this.querySelector('#ui-overlay');
    if (overlay) overlay.classList.remove('opacity-0');
    if (this.uiTimeout) {
      clearTimeout(this.uiTimeout);
      this.uiTimeout = null;
    }

    if (this.state.isStatsOverlayOpen || this.state.isJournalOverlayOpen) {
      return;
    }

    if (this.isMobileUiMode()) {
      return;
    }

    this.uiTimeout = window.setTimeout(() => {
      if (overlay && !this.state.selectedEntity) overlay.classList.add('opacity-0');
    }, 5000);
  };

  private readonly handleViewportModeChange = () => {
    this.resetUIOverlayOpacity();
    if (this.state.selectedEntity) this.updateUI();
  };

  private isMobileUiMode(): boolean {
    return this.coarsePointerMediaQuery.matches || this.mobileViewportMediaQuery.matches;
  }

  private setupEventListeners() {
    this.addEventListener('entity-selected', this.handleEntitySelected as EventListener);
    this.addEventListener('stats-overlay-open-requested', this.handleStatsOverlayOpen as EventListener);
    this.addEventListener('stats-overlay-closed', this.handleStatsOverlayClosed as EventListener);
    this.addEventListener('journal-overlay-open-requested', this.handleJournalOverlayOpen as EventListener);
    this.addEventListener('journal-overlay-closed', this.handleJournalOverlayClosed as EventListener);
    const journalToggle = this.querySelector('[data-journal-toggle]');
    journalToggle?.addEventListener('click', this.handleJournalToggle);
    window.addEventListener('mousemove', this.resetUIOverlayOpacity);
    window.addEventListener('click', this.resetUIOverlayOpacity);
    window.addEventListener('pointerdown', this.resetUIOverlayOpacity);
    window.addEventListener('resize', this.handleViewportModeChange);
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);
    this.coarsePointerMediaQuery.addEventListener('change', this.handleViewportModeChange);
    this.mobileViewportMediaQuery.addEventListener('change', this.handleViewportModeChange);
    this.resetUIOverlayOpacity();
  }

  private teardownEventListeners() {
    this.removeEventListener('entity-selected', this.handleEntitySelected as EventListener);
    this.removeEventListener('stats-overlay-open-requested', this.handleStatsOverlayOpen as EventListener);
    this.removeEventListener('stats-overlay-closed', this.handleStatsOverlayClosed as EventListener);
    this.removeEventListener('journal-overlay-open-requested', this.handleJournalOverlayOpen as EventListener);
    this.removeEventListener('journal-overlay-closed', this.handleJournalOverlayClosed as EventListener);
    const journalToggle = this.querySelector('[data-journal-toggle]');
    journalToggle?.removeEventListener('click', this.handleJournalToggle);
    window.removeEventListener('mousemove', this.resetUIOverlayOpacity);
    window.removeEventListener('click', this.resetUIOverlayOpacity);
    window.removeEventListener('pointerdown', this.resetUIOverlayOpacity);
    window.removeEventListener('resize', this.handleViewportModeChange);
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    this.coarsePointerMediaQuery.removeEventListener('change', this.handleViewportModeChange);
    this.mobileViewportMediaQuery.removeEventListener('change', this.handleViewportModeChange);
  }

  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.loadGardenData();
      this.checkHealth();
    }
    void this.soundscapeController?.handleVisibilityChange(document.visibilityState === 'visible');
  };

  private readonly handleOnline = () => {
    this.loadGardenData();
    this.checkHealth();
  };

  private readonly handleStatsOverlayOpen = () => {
    const overlay = this.querySelector('stats-overlay') as HTMLElement & { openOverlay?: () => void };
    if (overlay?.openOverlay) {
      overlay.openOverlay();
      this.state.isStatsOverlayOpen = true;
      const overlayLayer = this.querySelector('#ui-overlay');
      overlayLayer?.classList.add('opacity-0');
    }
  };

  private readonly handleStatsOverlayClosed = () => {
    this.state.isStatsOverlayOpen = false;
    const overlayLayer = this.querySelector('#ui-overlay');
    overlayLayer?.classList.remove('opacity-0');
    this.resetUIOverlayOpacity();
  };

  private readonly handleJournalOverlayOpen = () => {
    const overlay = this.querySelector('journal-overlay') as HTMLElement & {
      openOverlay?: () => void;
      setEvents?: (events: SimulationEvent[]) => void;
    };
    if (overlay) {
      overlay.setEvents?.(this.state.recentEvents);
      overlay.openOverlay?.();
      this.state.isJournalOverlayOpen = true;
      const overlayLayer = this.querySelector('#ui-overlay');
      overlayLayer?.classList.add('opacity-0');
    }
  };

  private readonly handleJournalOverlayClosed = () => {
    this.state.isJournalOverlayOpen = false;
    const overlayLayer = this.querySelector('#ui-overlay');
    overlayLayer?.classList.remove('opacity-0');
    this.resetUIOverlayOpacity();
  };

  private async loadGardenData() {
    if (this.gardenRequestInFlight) {
      return;
    }

    try {
      this.gardenRequestInFlight = true;
      if (!this.state.hasLoadedOnce) {
        this.state.isLoading = true;
        this.updateUI();
      }

      const data = await this.gardenService.fetchGardenData();

      if (data) {
        const selectedEntityId = this.state.selectedEntity?.id;
        this.state.gardenState = data.gardenState;
        this.state.entities = data.entities;
        this.state.recentEvents = data.events;
        this.state.selectedEntity = selectedEntityId
          ? this.state.entities.find((entity) => entity.id === selectedEntityId) ?? null
          : null;

        if (data.gardenState.timestamp) {
          const newTickTime = new Date(data.gardenState.timestamp);
          if (!this.state.lastTickTime || newTickTime > this.state.lastTickTime) {
            this.state.lastTickTime = newTickTime;
          }
        }
        this.state.hasLoadedOnce = true;
      }
    } catch (error) {
      console.error('[GardenApp] Failed to load garden:', error);
      showNotification('Failed to load garden data. Please try again.', 'error');
    } finally {
      this.gardenRequestInFlight = false;
      this.state.isLoading = false;
      this.updateUI();
      this.updateSoundscape();
    }
  }

  private updateUI() {
    updateGardenUI(this, this.state, { isMobileUi: this.isMobileUiMode() });
    updateStatusIndicators(this, {
      gardenState: this.state.gardenState,
      health: this.state.health,
    });
  }

  private async checkHealth() {
    try {
      const health = await this.gardenService.checkHealth();
      this.state.health = health;
      if (health?.gardenState?.timestamp) {
        const newTickTime = new Date(health.gardenState.timestamp);
        if (!this.state.lastTickTime || newTickTime > this.state.lastTickTime) {
          this.state.lastTickTime = newTickTime;
        }
      }
    } catch (error) {
      console.error('[GardenApp] Health check failed:', error);
      this.state.health = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        gardenState: null,
        config: { tickIntervalMinutes: 15 },
      } as HealthStatus;
    } finally {
      updateStatusIndicators(this, {
        gardenState: this.state.gardenState,
        health: this.state.health,
      });
    }
  }

  private updateCountdown() {
    const countdownEl = document.getElementById('next-tick-countdown');
    const tickIntervalMinutes = this.state.health?.config?.tickIntervalMinutes;
    updateCountdownDisplay(this.state.lastTickTime, tickIntervalMinutes, countdownEl);
  }

  private updateSoundscape() {
    this.soundscapeController?.update({
      gardenState: this.state.gardenState,
      recentEvents: this.state.recentEvents,
      nowMs: Date.now(),
    });
  }
}

export function registerGardenApp() {
  if (!customElements.get('garden-app')) {
    customElements.define('garden-app', GardenApp);
  }
}
