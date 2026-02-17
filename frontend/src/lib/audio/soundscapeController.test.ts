import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GardenState, SimulationEvent } from '@chaos-garden/shared';
import { SoundscapeController } from './soundscapeController';
import type { SoundscapeEngine } from './soundscapeEngine';

interface FakeStorage {
  values: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class FakeRoot {
  private listeners = new Map<string, Array<(event: Event) => void>>();
  public emitted: Array<{ type: string; detail?: unknown }> = [];

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === 'function'
      ? listener
      : (event: Event) => listener.handleEvent(event);

    const existing = this.listeners.get(type) ?? [];
    existing.push(callback);
    this.listeners.set(type, existing);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === 'function'
      ? listener
      : (event: Event) => listener.handleEvent(event);

    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, existing.filter((item) => item !== callback));
  }

  dispatchEvent(event: Event): boolean {
    const customEvent = event as Event & { detail?: unknown };
    this.emitted.push({ type: event.type, detail: customEvent.detail });

    const listeners = this.listeners.get(event.type) ?? [];
    listeners.forEach((listener) => listener(event));
    return true;
  }

  emit(type: string, detail?: unknown): void {
    const event = new Event(type) as Event & { detail?: unknown };
    event.detail = detail;
    const listeners = this.listeners.get(type) ?? [];
    listeners.forEach((listener) => listener(event));
  }
}

function createStorage(initial: Record<string, string> = {}): FakeStorage {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    values,
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
  };
}

function createGardenState(): GardenState {
  return {
    id: 1,
    tick: 42,
    timestamp: '2026-02-01T00:00:00.000Z',
    environment: {
      temperature: 21,
      sunlight: 0.63,
      moisture: 0.48,
      tick: 42,
      weatherState: {
        currentState: 'RAIN',
        stateEnteredAtTick: 40,
        plannedDurationTicks: 12,
        previousState: 'OVERCAST',
        transitionProgressTicks: 2,
      },
    },
    populationSummary: {
      plants: 90,
      herbivores: 28,
      carnivores: 12,
      fungi: 16,
      deadPlants: 1,
      deadHerbivores: 1,
      deadCarnivores: 0,
      deadFungi: 0,
      allTimeDeadPlants: 40,
      allTimeDeadHerbivores: 30,
      allTimeDeadCarnivores: 10,
      allTimeDeadFungi: 14,
      total: 146,
      totalLiving: 146,
      totalDead: 2,
      allTimeDead: 94,
    },
  };
}

function createEvent(id: number, eventType: SimulationEvent['eventType']): SimulationEvent {
  return {
    id,
    gardenStateId: 1,
    tick: 42,
    timestamp: `2026-02-01T00:00:0${id}.000Z`,
    eventType,
    description: `${eventType} event`,
    entitiesAffected: [],
    tags: [],
    severity: 'HIGH',
  };
}

describe('audio/soundscapeController', () => {
  beforeEach(() => {
    if (typeof CustomEvent === 'undefined') {
      class CustomEventPolyfill<T> extends Event {
        detail: T;

        constructor(type: string, params?: CustomEventInit<T>) {
          super(type, params);
          this.detail = params?.detail as T;
        }
      }
      (globalThis as unknown as { CustomEvent: typeof CustomEventPolyfill }).CustomEvent = CustomEventPolyfill;
    }
    vi.restoreAllMocks();
  });

  it('loads defaults and persists mute/volume updates', () => {
    const storage = createStorage();
    const root = new FakeRoot();

    const controller = new SoundscapeController({
      storage,
      createEngine: () => null,
    });

    controller.connectUi(root as unknown as HTMLElement);
    controller.setMuted(false);
    controller.setMasterVolume(0.8);

    const latestUiEvent = root.emitted.filter((event) => event.type === 'audio-state-changed').at(-1);

    expect(storage.values.get('chaos_garden_audio_muted')).toBe('false');
    expect(storage.values.get('chaos_garden_audio_volume')).toBe('0.8');
    expect(latestUiEvent?.detail).toMatchObject({ muted: false, volume: 0.8 });
  });

  it('enables engine on first gesture and applies latest state', () => {
    const storage = createStorage();
    const root = new FakeRoot();

    const fakeEngine: SoundscapeEngine = {
      setMasterVolume: vi.fn(),
      setMuted: vi.fn(),
      applyState: vi.fn(),
      triggerAccents: vi.fn(),
      suspend: vi.fn(async () => undefined),
      resume: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const controller = new SoundscapeController({
      storage,
      createEngine: () => fakeEngine,
    });

    controller.connectUi(root as unknown as HTMLElement);
    controller.update({
      gardenState: createGardenState(),
      recentEvents: [],
    });

    root.emit('audio-user-gesture');

    expect(fakeEngine.resume).toHaveBeenCalledTimes(1);
    expect(fakeEngine.applyState).toHaveBeenCalledTimes(1);
    expect(storage.values.get('chaos_garden_audio_user_enabled')).toBe('true');
  });

  it('deduplicates repeated event accents across updates', () => {
    const storage = createStorage({ chaos_garden_audio_user_enabled: 'true' });
    const root = new FakeRoot();

    const fakeEngine: SoundscapeEngine = {
      setMasterVolume: vi.fn(),
      setMuted: vi.fn(),
      applyState: vi.fn(),
      triggerAccents: vi.fn(),
      suspend: vi.fn(async () => undefined),
      resume: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const controller = new SoundscapeController({
      storage,
      createEngine: () => fakeEngine,
    });

    controller.connectUi(root as unknown as HTMLElement);

    const events = [createEvent(1, 'BIRTH'), createEvent(2, 'DEATH')];

    controller.update({
      gardenState: createGardenState(),
      recentEvents: events,
    });

    controller.update({
      gardenState: createGardenState(),
      recentEvents: events,
    });

    expect(fakeEngine.triggerAccents).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ type: 'BIRTH' }),
        expect.objectContaining({ type: 'DEATH' }),
      ]),
    );
    expect(fakeEngine.triggerAccents).toHaveBeenNthCalledWith(2, []);
  });
});
