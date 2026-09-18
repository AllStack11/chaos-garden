<script lang="ts">
  import GlassPanel from '../shared/GlassPanel.svelte';
  import { gardenState } from '../../state/gardenState.svelte.js';
  import { curatorState, type CuratorTool } from '../../state/curatorState.svelte.js';

  interface Props {
    onSpeedChange: (speed: number) => void;
    onTogglePause: () => void;
    onSelectTool: (tool: CuratorTool) => void;
    onToggleFollowCam: () => void;
  }

  let {
    onSpeedChange,
    onTogglePause,
    onSelectTool,
    onToggleFollowCam,
  }: Props = $props();

  const speeds = [0.5, 1, 2, 5, 10];

  const tools: { id: CuratorTool; label: string; icon: string; color: string }[] = [
    { id: 'INSPECT', label: 'Inspect', icon: '🔍', color: 'text-slate-200' },
    { id: 'WATER', label: 'Water Soil', icon: '💧', color: 'text-blue-400' },
    { id: 'NUTRIENTS', label: 'Fertilize', icon: '✨', color: 'text-emerald-400' },
    { id: 'SPAWN_PLANT', label: '+Flora', icon: '🌿', color: 'text-emerald-300' },
    { id: 'SPAWN_HERBIVORE', label: '+Herbivore', icon: '🐟', color: 'text-cyan-300' },
    { id: 'SPAWN_CARNIVORE', label: '+Carnivore', icon: '🦈', color: 'text-rose-400' },
    { id: 'SPAWN_FUNGUS', label: '+Fungus', icon: '🍄', color: 'text-purple-300' },
  ];
</script>

<GlassPanel class="px-4 py-2 flex items-center gap-4 pointer-events-auto">
  <!-- Play/Pause -->
  <button
    class="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 transition border border-slate-600 text-sm font-bold"
    onclick={onTogglePause}
    title={gardenState.isPaused ? 'Resume Simulation' : 'Pause Simulation'}
  >
    {gardenState.isPaused ? '▶' : '⏸'}
  </button>

  <!-- Speed Buttons -->
  <div class="flex items-center bg-slate-950/60 p-1 rounded-lg border border-slate-800 gap-1 text-xs font-mono">
    {#each speeds as s}
      <button
        class="px-2 py-0.5 rounded transition {gardenState.speedMultiplier === s ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}"
        onclick={() => onSpeedChange(s)}
      >
        {s}x
      </button>
    {/each}
  </div>

  <div class="h-6 w-[1px] bg-slate-700/60"></div>

  <!-- Curator Tools Dock -->
  <div class="flex items-center gap-1.5">
    {#each tools as t}
      <button
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition border {curatorState.activeTool === t.id ? 'bg-slate-800 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-transparent bg-slate-900/40 hover:bg-slate-800/60 text-slate-300'}"
        onclick={() => onSelectTool(t.id)}
        title={t.label}
      >
        <span>{t.icon}</span>
        <span class="{t.color} hidden sm:inline">{t.label}</span>
      </button>
    {/each}
  </div>

  <div class="h-6 w-[1px] bg-slate-700/60"></div>

  <!-- Auxiliary Drawers / Actions -->
  <div class="flex items-center gap-2">
    <!-- Follow-Cam Toggle -->
    <button
      class="px-2.5 py-1 rounded-lg text-xs font-medium transition border {curatorState.isFollowCamActive ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:text-slate-200'}"
      onclick={onToggleFollowCam}
      title="Lock camera to selected organism"
    >
      🎯 Follow
    </button>

    <!-- Chronicle Timeline Drawer Button -->
    <button
      class="px-2.5 py-1 rounded-lg text-xs font-medium transition border {curatorState.isChronicleOpen ? 'bg-purple-950 border-purple-500 text-purple-300' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:text-slate-200'}"
      onclick={() => curatorState.toggleChronicle()}
      title="Terrarium Chronicle Milestones"
    >
      📜 Chronicle
    </button>

    <!-- 1-Click LLM Diagnostics Button -->
    <button
      class="px-2.5 py-1 rounded-lg text-xs font-medium transition border {curatorState.isDiagnosticsOpen ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:text-slate-200'}"
      onclick={() => curatorState.toggleDiagnostics()}
      title="LLM Diagnostics & Flight Recorder Dump"
    >
      🤖 AI Audit
    </button>
  </div>
</GlassPanel>

