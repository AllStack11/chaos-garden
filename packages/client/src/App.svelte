<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import GardenCanvas from './ui/components/GardenCanvas.svelte';
  import StatsHUD from './ui/components/StatsHUD.svelte';
  import CuratorToolbar from './ui/components/CuratorToolbar.svelte';
  import EntityInspector from './ui/components/EntityInspector.svelte';
  import ChronicleDrawer from './ui/components/ChronicleDrawer.svelte';
  import LlmDiagnosticsModal from './ui/components/LlmDiagnosticsModal.svelte';
  import AudioControls from './ui/components/AudioControls.svelte';

  import { WorkerBridge } from './worker/WorkerBridge.js';
  import { ProceduralSoundscape } from './audio/ProceduralSoundscape.js';
  import { VisibilityManager } from './power/VisibilityManager.js';
  import { localPersistence } from './storage/LocalPersistence.js';
  import { gardenState } from './state/gardenState.svelte.js';
  import { curatorState, type CuratorTool } from './state/curatorState.svelte.js';
  import type { GardenViewport } from './renderer/GardenViewport.js';

  let bridge = $state<WorkerBridge | null>(null);
  let audio = $state<ProceduralSoundscape | null>(null);
  let visibilityManager: VisibilityManager | null = null;
  let viewport: GardenViewport | null = null;

  let audioVolume = $state(0.7);
  let audioMuted = $state(false);

  function handleViewportReady(v: GardenViewport): void {
    viewport = v;
    visibilityManager?.setViewport(v);
  }

  function handleSpeedChange(speed: number): void {
    gardenState.setSpeed(speed);
    bridge?.setSpeed(speed);
  }

  function handleTogglePause(): void {
    gardenState.togglePause();
    bridge?.setSpeed(gardenState.speedMultiplier);
  }

  function handleSelectTool(tool: CuratorTool): void {
    curatorState.setTool(tool);
    audio?.sfx.playClick();
  }

  function handleToggleFollowCam(): void {
    curatorState.isFollowCamActive = !curatorState.isFollowCamActive;
    if (curatorState.isFollowCamActive && gardenState.selectedEntity && viewport) {
      viewport.camera.setFollowTarget(gardenState.selectedEntity);
    } else {
      viewport?.camera.disengageFollow();
    }
    audio?.sfx.playClick();
  }

  function handleFollowEntity(): void {
    curatorState.isFollowCamActive = true;
    if (gardenState.selectedEntity && viewport) {
      viewport.camera.setFollowTarget(gardenState.selectedEntity);
    }
  }

  function handleFeedEntity(idHash: number): void {
    if (gardenState.selectedEntity && bridge) {
      bridge.dispatchCuratorAction('DROP_NUTRIENT', {
        x: gardenState.selectedEntity.x,
        y: gardenState.selectedEntity.y,
      }, 0.5);
      audio?.sfx.playNutrientSparkle();
    }
  }

  function handleCullEntity(idHash: number): void {
    audio?.sfx.playDeath();
    gardenState.selectedEntity = null;
  }

  function handleCloseInspector(): void {
    gardenState.selectedEntity = null;
    curatorState.isFollowCamActive = false;
    viewport?.camera.disengageFollow();
  }

  function handleVolumeChange(val: number): void {
    audioVolume = val;
    audio?.setMasterVolume(val);
  }

  function handleToggleMute(): void {
    audioMuted = !audioMuted;
    audio?.setMuted(audioMuted);
  }

  onMount(async () => {
    audio = new ProceduralSoundscape();

    bridge = new WorkerBridge({
      onRenderFrame: (_tick, entityCount, buffer) => {
        viewport?.renderFrame(buffer, entityCount);
        // Zero-copy return to worker pool
        bridge?.returnRenderBuffer(buffer);
      },
      onSoilUpdate: (_tick, _cols, _rows, moistureBuffer, nitrateBuffer) => {
        viewport?.updateSoil(moistureBuffer, nitrateBuffer);
      },
      onTelemetry: (pulse) => {
        gardenState.updateFromTelemetry(pulse);

        // Modulate procedural audio with trophic balance
        audio?.harmonizer.updateHarmony(
          gardenState.plantRatio,
          gardenState.herbivoreRatio,
          gardenState.carnivoreRatio,
        );

        // Modulate diurnal daylight cycle
        const sunlight = 0.5 + 0.5 * Math.sin((pulse.tick / 1200) * Math.PI * 2);
        viewport?.updateAtmosphere(sunlight, 0.0);
        audio?.drone.setSunlight(sunlight);
      },
    });

    visibilityManager = new VisibilityManager({
      bridge,
      audio,
    });

    // Offline-first bootloader
    const bootResult = await localPersistence.bootload();
    bridge.init(42, 1600, 1200, bootResult.data ?? undefined);

    // 30-second autosave
    localPersistence.startAutosave(bridge, 30000);
  });

  onDestroy(() => {
    localPersistence.stopAutosave();
    visibilityManager?.destroy();
    bridge?.terminate();
    audio?.destroy();
  });
</script>

<main class="w-full h-screen relative bg-garden-bg text-slate-100 overflow-hidden font-sans select-none">
  <!-- PixiJS Canvas Viewport Layer -->
  {#if bridge && audio}
    <GardenCanvas
      {bridge}
      {audio}
      onViewportReady={handleViewportReady}
    />
  {/if}

  <!-- Floating HUD Layer: Top Bar -->
  <div class="absolute top-4 left-4 z-20 pointer-events-none">
    <StatsHUD />
  </div>

  <div class="absolute top-4 right-4 z-20 pointer-events-none">
    <AudioControls
      volume={audioVolume}
      isMuted={audioMuted}
      onVolumeChange={handleVolumeChange}
      onToggleMute={handleToggleMute}
    />
  </div>

  <!-- Floating HUD Layer: Selected Entity Inspector -->
  <div class="absolute top-16 right-4 z-20 pointer-events-none">
    <EntityInspector
      onFollow={handleFollowEntity}
      onFeed={handleFeedEntity}
      onCull={handleCullEntity}
      onClose={handleCloseInspector}
    />
  </div>

  <!-- Floating HUD Layer: Bottom Curator Toolbar -->
  <div class="absolute bottom-6 inset-x-0 flex justify-center z-20 pointer-events-none px-4">
    <CuratorToolbar
      onSpeedChange={handleSpeedChange}
      onTogglePause={handleTogglePause}
      onSelectTool={handleSelectTool}
      onToggleFollowCam={handleToggleFollowCam}
    />
  </div>

  <!-- Slide-Out Chronicle Milestone Drawer -->
  <ChronicleDrawer />

  <!-- 1-Click AI Diagnostics Modal -->
  <LlmDiagnosticsModal />
</main>
