import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import GardenCanvas from '../../src/ui/components/GardenCanvas.svelte';
import { curatorState } from '../../src/state/curatorState.svelte.js';
import { GardenViewport } from '../../src/renderer/GardenViewport.js';

describe('GardenCanvas Svelte Component & Interaction Tests (happy-dom)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    vi.spyOn(GardenViewport.prototype, 'init').mockResolvedValue(undefined);
    vi.spyOn(GardenViewport.prototype, 'destroy').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('mounts canvas, executes brush actions, and dispatches to bridge & audio', async () => {
    const mockBridge = {
      dispatchCuratorAction: vi.fn(),
    };

    const mockAudio = {
      unlock: vi.fn(),
      sfx: {
        playWaterDrop: vi.fn(),
        playNutrientSparkle: vi.fn(),
        playBirth: vi.fn(),
      },
    };

    const onViewportReady = vi.fn();

    const component = mount(GardenCanvas, {
      target: container,
      props: {
        bridge: mockBridge as any,
        audio: mockAudio as any,
        onViewportReady,
      },
    });

    // Wait for onMount async init
    await new Promise((r) => setTimeout(r, 20));
    flushSync();

    expect(onViewportReady).toHaveBeenCalled();
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    // Mock canvas.setPointerCapture
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();

    // 1. WATER tool
    curatorState.setTool('WATER');
    const pointerDownWater = new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      button: 0,
    });
    canvas.dispatchEvent(pointerDownWater);
    flushSync();

    expect(mockAudio.unlock).toHaveBeenCalled();
    expect(mockBridge.dispatchCuratorAction).toHaveBeenCalledWith(
      'WATER_SOIL',
      expect.objectContaining({ amount: 0.4 }),
    );
    expect(mockAudio.sfx.playWaterDrop).toHaveBeenCalled();

    // Pointer move while brush active
    const pointerMove = new PointerEvent('pointermove', {
      bubbles: true,
      clientX: 420,
      clientY: 310,
      pointerId: 1,
      buttons: 1,
    });
    canvas.dispatchEvent(pointerMove);
    flushSync();
    expect(mockBridge.dispatchCuratorAction).toHaveBeenCalledTimes(2);

    // Pointer up
    const pointerUp = new PointerEvent('pointerup', {
      bubbles: true,
      clientX: 420,
      clientY: 310,
      pointerId: 1,
    });
    canvas.dispatchEvent(pointerUp);
    flushSync();

    // 2. NUTRIENTS tool
    curatorState.setTool('NUTRIENTS');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200, pointerId: 1, button: 0 }));
    flushSync();
    expect(mockBridge.dispatchCuratorAction).toHaveBeenCalledWith(
      'DROP_NUTRIENT',
      expect.objectContaining({ amount: 0.4 }),
    );
    expect(mockAudio.sfx.playNutrientSparkle).toHaveBeenCalled();

    // 3. SPAWN tools
    const spawnTools: [any, string][] = [
      ['SPAWN_PLANT', 'SPAWN_PLANT'],
      ['SPAWN_HERBIVORE', 'SPAWN_HERBIVORE'],
      ['SPAWN_CARNIVORE', 'SPAWN_CARNIVORE'],
      ['SPAWN_FUNGUS', 'SPAWN_FUNGUS'],
    ];

    for (const [tool, action] of spawnTools) {
      curatorState.setTool(tool);
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100, pointerId: 1, button: 0 }));
      flushSync();
      expect(mockBridge.dispatchCuratorAction).toHaveBeenCalledWith(action, expect.anything());
    }

    // 4. INSPECT tool dragging
    curatorState.setTool('INSPECT');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50, pointerId: 1, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 60, clientY: 60, pointerId: 1, buttons: 1 }));
    flushSync();

    // 5. Wheel event zoom
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      clientX: 400,
      clientY: 300,
      deltaY: -100,
    });
    canvas.dispatchEvent(wheelEvent);
    flushSync();

    unmount(component);
  });
});
