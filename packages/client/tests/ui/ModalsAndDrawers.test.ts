import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import ChronicleDrawer from '../../src/ui/components/ChronicleDrawer.svelte';
import LlmDiagnosticsModal from '../../src/ui/components/LlmDiagnosticsModal.svelte';
import CuratorToolbar from '../../src/ui/components/CuratorToolbar.svelte';
import { curatorState } from '../../src/state/curatorState.svelte.js';
import { gardenState } from '../../src/state/gardenState.svelte.js';

describe('Modals, Drawers & Curator Controls Live Reactivity (happy-dom)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    curatorState.isChronicleOpen = false;
    curatorState.isDiagnosticsOpen = false;
    vi.restoreAllMocks();
  });

  it('mounts ChronicleDrawer, accumulates milestones reactively, and closes', () => {
    curatorState.isChronicleOpen = true;
    gardenState.tick = 0;
    gardenState.populations.carnivores = 0;

    const component = mount(ChronicleDrawer, { target: container });
    flushSync();

    expect(container.textContent).toContain('Terrarium Chronicle');
    expect(container.textContent).toContain('Primordial Genesis');

    // Advance tick to 500
    flushSync(() => {
      gardenState.tick = 500;
    });
    expect(container.textContent).toContain('Ecological Stabilization');

    // Increase carnivore population to 12
    flushSync(() => {
      gardenState.populations.carnivores = 12;
    });
    expect(container.textContent).toContain('Apex Pack Emergence');

    // Click close button
    const closeBtn = container.querySelector('button') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    flushSync();

    expect(curatorState.isChronicleOpen).toBe(false);
    unmount(component);
  });

  it('mounts LlmDiagnosticsModal, queries bridge diagnostics, copies prompt, and dismisses', async () => {
    curatorState.isDiagnosticsOpen = true;

    const mockDiagnostics = {
      tick: 600,
      timestamp: '2026-09-22T12:00:00Z',
      tps: 60,
      tickDurationMs: 1.25,
      populations: {
        plants: 120,
        herbivores: 45,
        carnivores: 12,
        fungi: 18,
        totalLiving: 195,
        totalBiomass: 9500,
        deadMatterCount: 4,
        allTimeBirths: 210,
        allTimeDeaths: 15,
      },
      vitals: {
        predatorPreyRatio: 0.266,
        avgEnergy: 75.4,
        avgHealth: 92.1,
        biodiversityIndex: 1.35,
        soilAverageMoisture: 0.65,
        soilAverageNitrates: 0.42,
        aridLandPercentage: 0.05,
      },
      recentAnomalies: [],
    };

    const mockBridge = {
      requestDiagnostics: vi.fn(async () => mockDiagnostics),
    };

    // Mock clipboard
    const writeTextMock = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const component = mount(LlmDiagnosticsModal, {
      target: container,
      props: { bridge: mockBridge as any },
    });

    flushSync();
    expect(container.textContent).toContain('1-Click AI Diagnostic Export');

    // Wait for promise resolution
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    expect(mockBridge.requestDiagnostics).toHaveBeenCalled();
    expect(container.textContent).toContain('Flight Recorder Diagnostic Snapshot');
    expect(container.textContent).toContain('**Tick**: 600');

    // Click copy prompt button
    const copyButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy AI Diagnostic Prompt'),
    );
    expect(copyButton).toBeDefined();
    copyButton?.click();
    await new Promise((r) => setTimeout(r, 10));
    flushSync();

    expect(writeTextMock).toHaveBeenCalled();
    expect(container.textContent).toContain('Copied to Clipboard!');

    // Click Dismiss button
    const dismissButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Dismiss'),
    );
    expect(dismissButton).toBeDefined();
    dismissButton?.click();
    flushSync();
    expect(curatorState.isDiagnosticsOpen).toBe(false);

    unmount(component);
  });

  it('renders CuratorToolbar and handles all tool and auxiliary button actions', () => {
    const onSpeedChange = vi.fn();
    const onTogglePause = vi.fn();
    const onSelectTool = vi.fn();
    const onToggleFollowCam = vi.fn();

    const component = mount(CuratorToolbar, {
      target: container,
      props: {
        onSpeedChange,
        onTogglePause,
        onSelectTool,
        onToggleFollowCam,
      },
    });

    flushSync();

    // Check all speed buttons
    const speedButtons = ['0.5x', '1x', '2x', '5x', '10x'];
    speedButtons.forEach((label) => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label,
      );
      expect(btn).toBeDefined();
      btn?.click();
    });
    expect(onSpeedChange).toHaveBeenCalledTimes(5);

    // Play/Pause button
    const pauseBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('title')?.includes('Simulation'),
    );
    pauseBtn?.click();
    expect(onTogglePause).toHaveBeenCalledTimes(1);

    // Tool buttons
    const toolLabels = [
      'Inspect',
      'Water Soil',
      'Fertilize',
      '+Flora',
      '+Herbivore',
      '+Carnivore',
      '+Fungus',
    ];
    toolLabels.forEach((label) => {
      const btn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(label),
      );
      expect(btn).toBeDefined();
      btn?.click();
    });
    expect(onSelectTool).toHaveBeenCalledTimes(7);

    // Auxiliary buttons
    const followCamBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('title')?.includes('Lock camera'),
    );
    followCamBtn?.click();
    expect(onToggleFollowCam).toHaveBeenCalledTimes(1);

    const chronicleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Chronicle'),
    );
    chronicleBtn?.click();
    expect(curatorState.isChronicleOpen).toBe(true);

    const aiAuditBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('AI Audit'),
    );
    aiAuditBtn?.click();
    expect(curatorState.isDiagnosticsOpen).toBe(true);

    unmount(component);
  });
});
