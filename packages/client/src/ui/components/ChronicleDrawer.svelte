<script lang="ts">
  import GlassPanel from '../shared/GlassPanel.svelte';
  import { curatorState } from '../../state/curatorState.svelte.js';
  import { gardenState } from '../../state/gardenState.svelte.js';

  interface Milestone {
    tick: number;
    title: string;
    description: string;
    icon: string;
    color: string;
  }

  let milestones = $state<Milestone[]>([
    {
      tick: 0,
      title: 'Primordial Genesis',
      description: 'Ecosystem seeded across Flora, Herbivores, Carnivores, and Fungi.',
      icon: '🌱',
      color: 'text-emerald-400 border-emerald-500/40',
    },
  ]);

  // Dynamically record milestones as tick advances
  $effect(() => {
    if (gardenState.tick >= 500 && milestones.length === 1) {
      milestones.push({
        tick: 500,
        title: 'Ecological Stabilization',
        description: 'Nutrient diffusion and predatory balance reached dynamic equilibrium.',
        icon: '⚖️',
        color: 'text-cyan-400 border-cyan-500/40',
      });
    }
    if (gardenState.populations.carnivores >= 10 && milestones.length <= 2) {
      milestones.push({
        tick: gardenState.tick,
        title: 'Apex Pack Emergence',
        description: 'Carnivore population successfully colonized the upper trophic tier.',
        icon: '🦈',
        color: 'text-rose-400 border-rose-500/40',
      });
    }
  });
</script>

{#if curatorState.isChronicleOpen}
  <div class="fixed inset-y-0 right-0 w-84 z-30 p-4 pointer-events-none flex flex-col justify-center">
    <GlassPanel class="h-[80vh] flex flex-col pointer-events-auto border-purple-500/40 shadow-2xl overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-700/60 pb-3 p-4">
        <div class="flex items-center gap-2">
          <span class="text-lg">📜</span>
          <h3 class="font-bold text-sm text-purple-300">Terrarium Chronicle</h3>
        </div>
        <button
          class="text-slate-400 hover:text-slate-200 text-sm font-bold"
          onclick={() => curatorState.toggleChronicle()}
        >
          ✕
        </button>
      </div>

      <!-- Timeline Items -->
      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-xs">
        {#each milestones as m}
          <div class="flex gap-2.5 items-start bg-slate-900/50 p-2.5 rounded-lg border {m.color}">
            <span class="text-base">{m.icon}</span>
            <div class="flex flex-col gap-0.5 flex-1">
              <div class="flex justify-between items-baseline">
                <span class="font-bold text-slate-200">{m.title}</span>
                <span class="text-[10px] text-slate-400">T{m.tick}</span>
              </div>
              <p class="text-[11px] text-slate-300 font-sans leading-relaxed">{m.description}</p>
            </div>
          </div>
        {/each}
      </div>
    </GlassPanel>
  </div>
{/if}

