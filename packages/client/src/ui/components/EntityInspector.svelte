<script lang="ts">
  import GlassPanel from '../shared/GlassPanel.svelte';
  import VitalsBar from '../shared/VitalsBar.svelte';
  import { gardenState } from '../../state/gardenState.svelte.js';
  import { curatorState } from '../../state/curatorState.svelte.js';
  import { EntityTypeCode } from '@chaos-garden/shared';

  interface Props {
    onFollow: () => void;
    onFeed: (idHash: number) => void;
    onCull: (idHash: number) => void;
    onClose: () => void;
  }

  let { onFollow, onFeed, onCull, onClose }: Props = $props();

  let entity = $derived(gardenState.selectedEntity);

  let typeBadgeClass = $derived(() => {
    if (!entity) return '';
    switch (entity.type) {
      case EntityTypeCode.PLANT:
        return 'bg-emerald-950 text-emerald-400 border-emerald-500/40';
      case EntityTypeCode.HERBIVORE:
        return 'bg-cyan-950 text-cyan-400 border-cyan-500/40';
      case EntityTypeCode.CARNIVORE:
        return 'bg-rose-950 text-rose-400 border-rose-500/40';
      case EntityTypeCode.FUNGUS:
        return 'bg-purple-950 text-purple-400 border-purple-500/40';
      default:
        return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  });
</script>

{#if entity}
  <GlassPanel class="w-80 p-4 flex flex-col gap-3 pointer-events-auto border-emerald-500/30 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
    <!-- Header -->
    <div class="flex items-start justify-between border-b border-slate-700/60 pb-2">
      <div>
        <div class="flex items-center gap-2">
          <span
            class="w-3 h-3 rounded-full border border-white/40 inline-block"
            style="background-color: hsl({entity.pigment}, 75%, 55%);"
            title="Genetic Pigment Hue: {entity.pigment}°"
          ></span>
          <h3 class="font-bold text-sm text-slate-100">{entity.name}</h3>
        </div>
        <span class="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border {typeBadgeClass()}">
          {entity.species} (Gen {entity.generation})
        </span>
      </div>
      <button
        class="text-slate-400 hover:text-slate-200 text-base font-bold px-1"
        onclick={onClose}
        title="Close Inspector"
      >
        ✕
      </button>
    </div>

    <!-- Vitals -->
    <div class="flex flex-col gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
      <VitalsBar label="Health" value={entity.health} max={100} color="bg-emerald-500" />
      <VitalsBar label="Energy" value={entity.energy} max={100} color="bg-amber-400" />
      <VitalsBar label="Lifespan" value={entity.age} max={entity.maxLifespan} color="bg-cyan-500" />
    </div>

    <!-- Chromosomes & Genetic Readout -->
    <div class="flex flex-col gap-1.5 text-xs font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
      <div class="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1">
        Chromosomes
      </div>
      <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300 pt-1">
        <div>Speed: <span class="text-white font-bold">{entity.speed}</span> / {entity.maxSpeed}</div>
        <div>Perception: <span class="text-white font-bold">{entity.perceptionRadius}px</span></div>
        <div>Repro Thresh: <span class="text-white font-bold">{entity.reproductionThreshold}</span></div>
        <div>Metabolism: <span class="text-white font-bold">{entity.metabolismRate.toFixed(2)}</span></div>
        <div>World Pos: <span class="text-slate-400">({entity.x}, {entity.y})</span></div>
        <div>Parent ID: <span class="text-slate-400">{entity.parentIndex === -1 ? 'Primordial' : '#' + entity.parentIndex}</span></div>
      </div>
    </div>

    <!-- Curator Actions -->
    <div class="grid grid-cols-3 gap-1.5 pt-1">
      <button
        class="px-2 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded text-xs font-medium transition"
        onclick={onFollow}
      >
        🎯 Follow
      </button>
      <button
        class="px-2 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded text-xs font-medium transition"
        onclick={() => onFeed(entity.idHash)}
      >
        🌿 Feed
      </button>
      <button
        class="px-2 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded text-xs font-medium transition"
        onclick={() => onCull(entity.idHash)}
      >
        ⚡ Cull
      </button>
    </div>
  </GlassPanel>
{/if}

