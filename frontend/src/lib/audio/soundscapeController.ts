import type { SimulationEvent } from '../../env.d.ts';
import type { SimulationEventType } from '@chaos-garden/shared';
import type {
  DerivedSoundscapeState,
  SoundscapeEventAccent,
  SoundscapeInput,
  SoundscapeUiState,
} from './types';
import {
  createWebAudioSoundscapeEngine,
  deriveEventAccents,
  deriveSoundscapeState,
  type SoundscapeEngine,
} from './soundscapeEngine';

const STORAGE_KEYS = {
  muted: 'chaos_garden_audio_muted',
  volume: 'chaos_garden_audio_volume',
  userEnabled: 'chaos_garden_audio_user_enabled',
} as const;

const ACCENT_DEDUP_WINDOW = 24;
const VOLUME_MIN = 0;
const VOLUME_MAX = 1;
const ACCENT_EVENT_TYPES: Set<SimulationEventType> = new Set([
  'BIRTH',
  'DEATH',
  'MUTATION',
  'EXTINCTION',
  'POPULATION_EXPLOSION',
  'ECOSYSTEM_COLLAPSE',
]);

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

interface SoundscapeControllerOptions {
  storage?: StorageLike;
  createEngine?: () => SoundscapeEngine | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }
  return value === 'true';
}

function parseVolume(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(parsed, VOLUME_MIN, VOLUME_MAX);
}

function buildEventKey(event: SimulationEvent): string {
  return [event.id ?? 'none', event.tick, event.timestamp, event.eventType, event.description].join('|');
}

export class SoundscapeController {
  private readonly storage: StorageLike | null;
  private readonly createEngine: () => SoundscapeEngine | null;

  private root: HTMLElement | null = null;
  private engine: SoundscapeEngine | null = null;
  private isSupported = true;
  private muted = true;
  private volume = 0.55;
  private userEnabled = false;

  private latestDerivedState: DerivedSoundscapeState | null = null;
  private recentAccentKeys: string[] = [];
  private accentKeySet: Set<string> = new Set();

  constructor(options: SoundscapeControllerOptions = {}) {
    this.storage = options.storage ?? this.resolveStorage();
    this.createEngine = options.createEngine ?? createWebAudioSoundscapeEngine;

    this.muted = parseBoolean(this.storage?.getItem(STORAGE_KEYS.muted) ?? null, true);
    this.volume = parseVolume(this.storage?.getItem(STORAGE_KEYS.volume) ?? null, 0.55);
    this.userEnabled = parseBoolean(this.storage?.getItem(STORAGE_KEYS.userEnabled) ?? null, false);

    if (this.userEnabled) {
      this.ensureEngine();
    } else {
      this.isSupported = this.createEngine !== null;
    }
  }

  private resolveStorage(): StorageLike | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  connectUi(root: HTMLElement): void {
    this.root = root;
    this.root.addEventListener('audio-toggle-requested', this.handleAudioToggleRequested as EventListener);
    this.root.addEventListener('audio-volume-changed', this.handleAudioVolumeChanged as EventListener);
    this.root.addEventListener('audio-user-gesture', this.handleAudioUserGesture as EventListener);
    this.emitUiState();
  }

  update(input: SoundscapeInput): void {
    const derived = deriveSoundscapeState(input);
    this.latestDerivedState = derived;

    if (!this.userEnabled || !this.engine) {
      return;
    }

    this.engine.applyState(derived);
    const dedupedAccents = this.collectNewAccents(input, deriveEventAccents(input));
    this.engine.triggerAccents(dedupedAccents);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.storage?.setItem(STORAGE_KEYS.muted, String(muted));
    this.engine?.setMuted(muted);
    this.emitUiState();
  }

  setMasterVolume(volume: number): void {
    const nextVolume = clamp(volume, VOLUME_MIN, VOLUME_MAX);
    this.volume = nextVolume;
    this.storage?.setItem(STORAGE_KEYS.volume, String(nextVolume));
    this.engine?.setMasterVolume(nextVolume);
    this.emitUiState();
  }

  handleUserGesture(): void {
    this.userEnabled = true;
    this.storage?.setItem(STORAGE_KEYS.userEnabled, 'true');
    this.ensureEngine();

    if (this.engine) {
      void this.engine.resume();
      this.engine.setMasterVolume(this.volume);
      this.engine.setMuted(this.muted);

      if (this.latestDerivedState) {
        this.engine.applyState(this.latestDerivedState);
      }
    }

    this.emitUiState();
  }

  async handleVisibilityChange(isVisible: boolean): Promise<void> {
    if (!this.engine || !this.userEnabled) {
      return;
    }

    if (isVisible) {
      await this.engine.resume();
      if (this.latestDerivedState) {
        this.engine.applyState(this.latestDerivedState);
      }
      return;
    }

    await this.engine.suspend();
  }

  dispose(): void {
    if (this.root) {
      this.root.removeEventListener('audio-toggle-requested', this.handleAudioToggleRequested as EventListener);
      this.root.removeEventListener('audio-volume-changed', this.handleAudioVolumeChanged as EventListener);
      this.root.removeEventListener('audio-user-gesture', this.handleAudioUserGesture as EventListener);
    }

    this.root = null;
    this.engine?.dispose();
    this.engine = null;
  }

  private readonly handleAudioToggleRequested = (event: Event): void => {
    this.handleUserGesture();
    const customEvent = event as CustomEvent<{ muted: boolean }>;
    this.setMuted(customEvent.detail.muted);
  };

  private readonly handleAudioVolumeChanged = (event: Event): void => {
    this.handleUserGesture();
    const customEvent = event as CustomEvent<{ volume: number }>;
    this.setMasterVolume(customEvent.detail.volume);
  };

  private readonly handleAudioUserGesture = (): void => {
    this.handleUserGesture();
  };

  private ensureEngine(): void {
    if (this.engine) {
      return;
    }

    this.engine = this.createEngine();
    if (!this.engine) {
      this.isSupported = false;
      this.emitUiState();
      return;
    }

    this.isSupported = true;
    this.engine.setMasterVolume(this.volume);
    this.engine.setMuted(this.muted);
  }

  private collectNewAccents(input: SoundscapeInput, accents: SoundscapeEventAccent[]): SoundscapeEventAccent[] {
    if (accents.length === 0 || input.recentEvents.length === 0) {
      return [];
    }

    const candidateEvents = input.recentEvents
      .filter((event) => ACCENT_EVENT_TYPES.has(event.eventType))
      .slice(-accents.length);
    const freshAccents: SoundscapeEventAccent[] = [];

    accents.forEach((accent, index) => {
      const sourceEvent = candidateEvents[index];
      if (!sourceEvent) {
        return;
      }

      const key = buildEventKey(sourceEvent);
      if (this.accentKeySet.has(key)) {
        return;
      }

      this.accentKeySet.add(key);
      this.recentAccentKeys.push(key);
      freshAccents.push(accent);
    });

    if (this.recentAccentKeys.length > ACCENT_DEDUP_WINDOW) {
      const removeCount = this.recentAccentKeys.length - ACCENT_DEDUP_WINDOW;
      const toDrop = this.recentAccentKeys.splice(0, removeCount);
      for (const key of toDrop) {
        this.accentKeySet.delete(key);
      }
    }

    return freshAccents;
  }

  private emitUiState(): void {
    if (!this.root) {
      return;
    }

    const state: SoundscapeUiState = {
      isSupported: this.isSupported,
      muted: this.muted,
      volume: this.volume,
      userEnabled: this.userEnabled,
    };

    this.root.dispatchEvent(new CustomEvent<SoundscapeUiState>('audio-state-changed', {
      detail: state,
      bubbles: true,
      composed: true,
    }));
  }
}
