<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GardenViewport } from '../../renderer/GardenViewport.js';
  import { curatorState } from '../../state/curatorState.svelte.js';
  import type { WorkerBridge } from '../../worker/WorkerBridge.js';
  import type { ProceduralSoundscape } from '../../audio/ProceduralSoundscape.js';

  interface Props {
    bridge: WorkerBridge;
    audio: ProceduralSoundscape;
    onViewportReady?: (viewport: GardenViewport) => void;
  }

  let { bridge, audio, onViewportReady }: Props = $props();

  let canvasElement: HTMLCanvasElement | null = $state(null);
  let containerElement: HTMLDivElement | null = $state(null);
  let viewport: GardenViewport | null = null;
  let resizeObserver: ResizeObserver | null = null;

  let isPointerDown = false;
  let isBrushActive = false;
  let pointerDownPos = { x: 0, y: 0 };

  function handlePointerDown(e: PointerEvent): void {
  async function handlePointerDown(e: PointerEvent): Promise<void> {
    if (!viewport || !canvasElement) return;

    // First user click unlocks procedural soundscape
    audio.unlock();

    canvasElement.setPointerCapture(e.pointerId);
    isPointerDown = true;
    pointerDownPos = { x: e.clientX, y: e.clientY };

    const screenX = e.clientX;
    const screenY = e.clientY;
    const worldPos = viewport.camera.screenToWorld(screenX, screenY);

    if (e.button === 1 || curatorState.activeTool === 'INSPECT') {
      // Middle click or Inspect tool: start panning
      viewport.camera.startDrag(screenX, screenY);
    } else {
      // Curator brush action
      isBrushActive = true;
      executeCuratorAction(worldPos);
    }
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!viewport) return;

    const screenX = e.clientX;
    const screenY = e.clientY;
    const worldPos = viewport.camera.screenToWorld(screenX, screenY);
    curatorState.cursorWorldPos = worldPos;

    if (isPointerDown) {
      if (curatorState.activeTool === 'INSPECT' || e.buttons === 4) {
        viewport.camera.drag(screenX, screenY);
      } else if (isBrushActive && (curatorState.activeTool === 'WATER' || curatorState.activeTool === 'NUTRIENTS')) {
        executeCuratorAction(worldPos);
      }
    }
  }

  function handlePointerUp(e: PointerEvent): void {
  async function handlePointerUp(e: PointerEvent): Promise<void> {
    if (!viewport || !canvasElement) return;

    if (canvasElement.hasPointerCapture(e.pointerId)) {
      canvasElement.releasePointerCapture(e.pointerId);
    }

    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);

    // If in INSPECT mode and pointer barely moved, treat as entity click/pick
    if (curatorState.activeTool === 'INSPECT' && dist < 5 && e.button === 0) {
      const worldPos = viewport.camera.screenToWorld(e.clientX, e.clientY);
      const pickedEntityId = await bridge.pickEntityAt(worldPos, 32);
      bridge.selectEntity(pickedEntityId);
      if (pickedEntityId !== null) {
        audio.sfx.playClick();
      }
    }

    isPointerDown = false;
    isBrushActive = false;
    viewport.camera.endDrag();
  }

  function handleWheel(e: WheelEvent): void {
    if (!viewport) return;
    e.preventDefault();

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    viewport.camera.zoomAt(e.clientX, e.clientY, zoomFactor);
  }

  function executeCuratorAction(worldPos: { x: number; y: number }): void {
    const tool = curatorState.activeTool;

    switch (tool) {
      case 'WATER':
        bridge.dispatchCuratorAction('WATER_SOIL', worldPos, 0.4);
        bridge.dispatchCuratorAction('WATER_SOIL', { position: worldPos, amount: 0.4 });
        audio.sfx.playWaterDrop();
        break;
      case 'NUTRIENTS':
        bridge.dispatchCuratorAction('DROP_NUTRIENT', worldPos, 0.4);
        bridge.dispatchCuratorAction('DROP_NUTRIENT', { position: worldPos, amount: 0.4 });
        audio.sfx.playNutrientSparkle();
        break;
      case 'SPAWN_PLANT':
        bridge.dispatchCuratorAction('SPAWN_PLANT', worldPos);
        bridge.dispatchCuratorAction('SPAWN_PLANT', { position: worldPos });
        audio.sfx.playBirth();
        break;
      case 'SPAWN_HERBIVORE':
        bridge.dispatchCuratorAction('SPAWN_HERBIVORE', worldPos);
        bridge.dispatchCuratorAction('SPAWN_HERBIVORE', { position: worldPos });
        audio.sfx.playBirth();
        break;
      case 'SPAWN_CARNIVORE':
        bridge.dispatchCuratorAction('SPAWN_CARNIVORE', worldPos);
        bridge.dispatchCuratorAction('SPAWN_CARNIVORE', { position: worldPos });
        audio.sfx.playBirth();
        break;
      case 'SPAWN_FUNGUS':
        bridge.dispatchCuratorAction('SPAWN_FUNGUS', worldPos);
        bridge.dispatchCuratorAction('SPAWN_FUNGUS', { position: worldPos });
        audio.sfx.playBirth();
        break;
    }
  }

  onMount(async () => {
    if (!canvasElement || !containerElement) return;

    const width = containerElement.clientWidth || window.innerWidth;
    const height = containerElement.clientHeight || window.innerHeight;

    viewport = new GardenViewport({
      canvas: canvasElement,
      worldWidth: 1600,
      worldHeight: 1200,
    });

    await viewport.init(canvasElement, width, height);
    onViewportReady?.(viewport);

    // Dynamic resize observer
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          viewport?.resize(w, h);
        }
      }
    });

    resizeObserver.observe(containerElement);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    viewport?.destroy();
  });
</script>

<div
  bind:this={containerElement}
  class="w-full h-full relative overflow-hidden cursor-crosshair"
>
  <canvas
    bind:this={canvasElement}
    class="w-full h-full block"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointerleave={handlePointerUp}
    onwheel={handleWheel}
  ></canvas>
</div>

