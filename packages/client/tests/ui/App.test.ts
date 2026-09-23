import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import App from '../../src/App.svelte';
import { gardenState } from '../../src/state/gardenState.svelte.js';
import { curatorState } from '../../src/state/curatorState.svelte.js';
import { localPersistence } from '../../src/storage/LocalPersistence.js';
import { GardenViewport } from '../../src/renderer/GardenViewport.js';
import { EntityTypeCode } from '@chaos-garden/shared';

// Web Audio Mock
class MockAudioParam {
  value: number = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn((val: number) => {
    this.value = val;
  });
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  type = 'lowpass';
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
  attack = new MockAudioParam();
  release = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  frequency = new MockAudioParam();
  detune = new MockAudioParam();
  type = 'sine';
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'running';
  currentTime: number = 0;
  sampleRate: number = 44100;
  destination = new MockAudioNode();

  createGain = vi.fn(() => new MockGainNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createDynamicsCompressor = vi.fn(() => new MockDynamicsCompressorNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBuffer = vi.fn((_channels, length, _sampleRate) => ({
    getChannelData: () => new Float32Array(length),
  }));
  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    loop: false,
  }));
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
}

// Mock Web Worker
let lastCreatedWorker: MockWorker | null = null;

class MockWorker {
  public postMessage = vi.fn((msg: any) => {
    if (msg?.type === 'INIT') {
      queueMicrotask(() => {
        this.simulateMessage({
          type: 'BOOTSTRAP_STATUS',
          requestId: msg.requestId,
          mode: 'primordial',
          success: true,
          tick: 0,
        });
      });
    }
  });
  public terminate = vi.fn();
  public onmessage: ((ev: MessageEvent) => any) | null = null;
  public onerror: ((ev: ErrorEvent) => any) | null = null;

  constructor() {
    lastCreatedWorker = this;
  }

  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('App.svelte Root Component Integration Tests (happy-dom)', () => {
  let container: HTMLDivElement;
  let originalAudioContext: any;
  let originalWorker: any;
  let originalResizeObserver: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    originalAudioContext = (globalThis as any).AudioContext;
    originalWorker = (globalThis as any).Worker;
    originalResizeObserver = (globalThis as any).ResizeObserver;

    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).Worker = MockWorker;
    (globalThis as any).ResizeObserver = MockResizeObserver;

    // Spy on GardenViewport to avoid real WebGL canvas init
    vi.spyOn(GardenViewport.prototype, 'init').mockResolvedValue(undefined);
    vi.spyOn(GardenViewport.prototype, 'renderFrame').mockImplementation(() => {});
    vi.spyOn(GardenViewport.prototype, 'updateSoil').mockImplementation(() => {});
    vi.spyOn(GardenViewport.prototype, 'updateAtmosphere').mockImplementation(() => {});
    vi.spyOn(GardenViewport.prototype, 'destroy').mockImplementation(() => {});

    // Spy on LocalPersistence
    vi.spyOn(localPersistence, 'bootload').mockResolvedValue({
      source: 'PRIMORDIAL',
      data: null,
    });
    vi.spyOn(localPersistence, 'startAutosave').mockImplementation(() => () => {});
    vi.spyOn(localPersistence, 'stopAutosave').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    (globalThis as any).AudioContext = originalAudioContext;
    (globalThis as any).Worker = originalWorker;
    (globalThis as any).ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it('mounts App cleanly, executes onMount, and renders HUD layers', async () => {
    const app = mount(App, { target: container });

    // Wait for onMount async promises (bootload + bridge.init)
    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    // Verify root container and elements rendered
    expect(container.querySelector('main')).toBeTruthy();
    expect(container.textContent).toContain('Tick');
    expect(container.textContent).toContain('P:');
    expect(container.textContent).toContain('Inspect');
    expect(container.textContent).toContain('Water Soil');

    // Verify local persistence bootloaded and autosave started
    expect(localPersistence.bootload).toHaveBeenCalled();
    expect(localPersistence.startAutosave).toHaveBeenCalled();
    expect(gardenState.bootstrapMode).toBe('primordial');

    // Unmount and verify cleanup
    unmount(app);
    expect(localPersistence.stopAutosave).toHaveBeenCalled();
  });

  it('handles simulation speed change and pause toggling via toolbar', async () => {
    const app = mount(App, { target: container });
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    // Click 2x speed button
    const buttons = Array.from(container.querySelectorAll('button'));
    const speed2xButton = buttons.find((b) => b.textContent?.trim() === '2x');
    expect(speed2xButton).toBeDefined();

    speed2xButton?.click();
    flushSync();
    expect(gardenState.speedMultiplier).toBe(2);
    expect(lastCreatedWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_SPEED', speedMultiplier: 2 }),
    );

    // Click pause button
    const pauseButton = buttons.find((b) => b.getAttribute('title')?.includes('Pause Simulation'));
    expect(pauseButton).toBeDefined();

    pauseButton?.click();
    flushSync();
    expect(gardenState.isPaused).toBe(true);

    // Click resume button
    const resumeButton = buttons.find((b) => b.getAttribute('title')?.includes('Resume Simulation'));
    expect(resumeButton).toBeDefined();

    resumeButton?.click();
    flushSync();
    expect(gardenState.isPaused).toBe(false);

    unmount(app);
  });

  it('handles curator tool selection', async () => {
    const app = mount(App, { target: container });
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    const buttons = Array.from(container.querySelectorAll('button'));
    const waterButton = buttons.find((b) => b.textContent?.includes('Water Soil'));
    expect(waterButton).toBeDefined();

    waterButton?.click();
    flushSync();
    expect(curatorState.activeTool).toBe('WATER');

    const carnivoreButton = buttons.find((b) => b.textContent?.includes('+Carnivore'));
    expect(carnivoreButton).toBeDefined();
    carnivoreButton?.click();
    flushSync();
    expect(curatorState.activeTool).toBe('SPAWN_CARNIVORE');

    unmount(app);
  });

  it('handles volume slider and mute button interactions', async () => {
    const app = mount(App, { target: container });
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    // Mute button
    const muteButton = container.querySelector('button[title*="Mute"]') as HTMLButtonElement;
    expect(muteButton).toBeTruthy();

    muteButton.click();
    flushSync();
    // After mute, title changes to 'Unmute Procedural Audio'
    expect(container.querySelector('button[title*="Unmute"]')).toBeTruthy();

    // Volume input
    const volumeInput = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(volumeInput).toBeTruthy();

    volumeInput.value = '0.35';
    volumeInput.dispatchEvent(new Event('input'));
    flushSync();

    unmount(app);
  });

  it('receives worker telemetry pulse and updates state and audio', async () => {
    const app = mount(App, { target: container });
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    expect(lastCreatedWorker).toBeTruthy();

    // Simulate worker telemetry message
    lastCreatedWorker?.simulateMessage({
      type: 'TELEMETRY_PULSE',
      tick: 300,
      tps: 60,
      populations: {
        plants: 80,
        herbivores: 20,
        carnivores: 5,
        fungi: 10,
        totalLiving: 115,
        totalBiomass: 6500,
      },
      selectedEntityVitals: null,
    });

    flushSync();
    expect(gardenState.tick).toBe(300);
    expect(container.textContent).toContain('Tick 300');
    expect(container.textContent).toContain('P: 80');

    // Simulate render frame message
    const renderBuf = new Float32Array(32 * 8);
    lastCreatedWorker?.simulateMessage({
      type: 'RENDER_FRAME',
      tick: 300,
      entityCount: 1,
      buffer: renderBuf,
    });

    // Simulate soil update message
    const moisture = new Float32Array(100);
    const nitrates = new Float32Array(100);
    lastCreatedWorker?.simulateMessage({
      type: 'SOIL_TEXTURE_UPDATE',
      tick: 300,
      cols: 10,
      rows: 10,
      moistureBuffer: moisture,
      nitrateBuffer: nitrates,
    });

    unmount(app);
  });

  it('exercises entity inspection, follow-cam, feeding, culling, and closing', async () => {
    const app = mount(App, { target: container });
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    // Select an entity via telemetry
    lastCreatedWorker?.simulateMessage({
      type: 'TELEMETRY_PULSE',
      tick: 100,
      tps: 60,
      populations: {
        plants: 50,
        herbivores: 10,
        carnivores: 2,
        fungi: 5,
        totalLiving: 67,
        totalBiomass: 3000,
      },
      selectedEntityVitals: {
        entityId: 42,
        parentEntityId: 0,
        idHash: 0x1234,
        name: 'Herbivore #42',
        species: 'Herbivore',
        age: 50,
        maxLifespan: 1000,
        energy: 85,
        health: 100,
        generation: 1,
        type: EntityTypeCode.HERBIVORE,
        pigment: 180,
        speed: 15,
        maxSpeed: 20,
        perceptionRadius: 50,
        reproductionThreshold: 60,
        metabolismRate: 0.1,
        x: 300,
        y: 400,
      },
    });

    flushSync();

    expect(container.textContent).toContain('Herbivore #42');

    // Follow Entity button
    const followButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Follow'),
    );
    expect(followButton).toBeDefined();
    followButton?.click();
    flushSync();
    expect(curatorState.isFollowCamActive).toBe(true);

    // Toggle follow cam from toolbar
    const toolbarFollowCamButton = container.querySelector('button[title*="Lock camera"]') as HTMLButtonElement;
    expect(toolbarFollowCamButton).toBeTruthy();
    toolbarFollowCamButton.click();
    flushSync();
    expect(curatorState.isFollowCamActive).toBe(false);

    // Feed entity button
    const feedButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Feed'),
    );
    expect(feedButton).toBeDefined();
    feedButton?.click();
    flushSync();
    expect(lastCreatedWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CURATOR_ACTION',
        action: 'DROP_NUTRIENT',
        position: { x: 300, y: 400 },
        amount: 0.5,
      }),
    );

    // Close inspector
    const closeInspectorButton = container.querySelector('button[title="Close Inspector"]') as HTMLButtonElement;
    expect(closeInspectorButton).toBeTruthy();
    closeInspectorButton.click();
    flushSync();
    expect(gardenState.selectedEntity).toBeNull();
    expect(container.textContent).not.toContain('Herbivore #42');

    // Reselect to test Cull Entity
    flushSync(() => {
      gardenState.selectedEntity = {
        entityId: 99,
        parentEntityId: 0,
        idHash: 0x9999,
        name: 'Herbivore #99',
        species: 'Herbivore',
        age: 20,
        maxLifespan: 1000,
        energy: 50,
        health: 50,
        generation: 1,
        type: EntityTypeCode.HERBIVORE,
        pigment: 180,
        speed: 10,
        maxSpeed: 20,
        perceptionRadius: 50,
        reproductionThreshold: 60,
        metabolismRate: 0.1,
        x: 100,
        y: 100,
      };
    });

    expect(container.textContent).toContain('Herbivore #99');
    const cullButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cull'),
    );
    expect(cullButton).toBeDefined();
    cullButton?.click();
    flushSync();
    expect(lastCreatedWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CURATOR_ACTION',
        action: 'CULL_ENTITY',
        entityId: 99,
      }),
    );
    expect(gardenState.selectedEntity).toBeNull();

    unmount(app);
  });
});
