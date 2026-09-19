<script lang="ts">
  import GlassPanel from '../shared/GlassPanel.svelte';
  import { gardenState } from '../../state/gardenState.svelte.js';

  let simulatedDays = $derived(Math.floor(gardenState.tick / 1200));
  let simulatedHours = $derived(Math.floor((gardenState.tick % 1200) / 50));

  let plantPercent = $derived((gardenState.plantRatio * 100).toFixed(1));
  let herbivorePercent = $derived((gardenState.herbivoreRatio * 100).toFixed(1));
  let carnivorePercent = $derived((gardenState.carnivoreRatio * 100).toFixed(1));
  let fungusPercent = $derived((gardenState.fungusRatio * 100).toFixed(1));
</script>

<GlassPanel class="p-4 w-72 flex flex-col gap-3 pointer-events-auto">
  <!-- Header & Age -->
  <div class="flex items-center justify-between border-b border-slate-700/50 pb-2">
    <div>
      <h2 class="text-sm font-semibold tracking-wider uppercase text-emerald-400">Chaos Garden</h2>
      <p class="text-xs text-slate-400 font-mono">
        Day {simulatedDays}, {simulatedHours.toString().padStart(2, '0')}:00
      </p>
    </div>
    <div class="text-right font-mono">
      <span class="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
        {gardenState.tps} TPS
      </span>
    </div>
  </div>

  <!-- Population & Biomass Metrics -->
  <div class="grid grid-cols-2 gap-2 text-xs font-mono">
    <div class="bg-slate-900/50 p-2 rounded border border-slate-800">
      <div class="text-[10px] text-slate-400 uppercase">Organisms</div>
      <div class="text-base font-bold text-white">{gardenState.populations.totalLiving}</div>
    </div>
    <div class="bg-slate-900/50 p-2 rounded border border-slate-800">
      <div class="text-[10px] text-slate-400 uppercase">Biomass</div>
      <div class="text-base font-bold text-emerald-300">{gardenState.populations.totalBiomass}</div>
    </div>
  </div>

  <!-- Trophic Stacked Distribution Bar -->
  <div class="flex flex-col gap-1.5">
    <div class="flex justify-between text-[11px] text-slate-400">
      <span>Trophic Balance</span>
      <span class="font-mono">Tick {gardenState.tick}</span>
    </div>

    <!-- Stacked Bar -->
    <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
      <div
        class="bg-emerald-500 h-full transition-all duration-300"
        style="width: {plantPercent}%"
        title="Plants: {gardenState.populations.plants}"
      ></div>
      <div
        class="bg-cyan-500 h-full transition-all duration-300"
        style="width: {herbivorePercent}%"
        title="Herbivores: {gardenState.populations.herbivores}"
      ></div>
      <div
        class="bg-rose-500 h-full transition-all duration-300"
        style="width: {carnivorePercent}%"
        title="Carnivores: {gardenState.populations.carnivores}"
      ></div>
      <div
        class="bg-purple-500 h-full transition-all duration-300"
        style="width: {fungusPercent}%"
        title="Fungi: {gardenState.populations.fungi}"
      ></div>
    </div>

    <!-- Legend -->
    <div class="grid grid-cols-4 gap-1 text-[10px] text-center pt-1 font-mono">
      <div class="text-emerald-400">P: {gardenState.populations.plants}</div>
      <div class="text-cyan-400">H: {gardenState.populations.herbivores}</div>
      <div class="text-rose-400">C: {gardenState.populations.carnivores}</div>
      <div class="text-purple-400">F: {gardenState.populations.fungi}</div>
    </div>
  </div>
</GlassPanel>

