<script lang="ts">
  import GlassPanel from '../shared/GlassPanel.svelte';
  import { curatorState } from '../../state/curatorState.svelte.js';
  import { gardenState } from '../../state/gardenState.svelte.js';
  import type { WorkerBridge } from '../../worker/WorkerBridge.js';
  import type { DiagnosticSnapshot } from '@chaos-garden/shared';

  interface Props {
    bridge?: WorkerBridge | null;
  }

  let { bridge }: Props = $props();

  let copied = $state(false);
  let diagnosticData = $state<DiagnosticSnapshot | null>(null);
  let isLoading = $state(false);

  $effect(() => {
    if (curatorState.isDiagnosticsOpen && bridge) {
      isLoading = true;
      bridge
        .requestDiagnostics()
        .then((data) => {
          diagnosticData = data;
          isLoading = false;
        })
        .catch((err) => {
          console.warn('[LlmDiagnosticsModal] Failed to fetch diagnostics:', err);
          isLoading = false;
        });
    }
  });

  function generatePrompt(): string {
    if (diagnosticData) {
      const d = diagnosticData;
      return `### Chaos Garden Flight Recorder Diagnostic Snapshot
- **Tick**: ${d.tick} | **Timestamp**: ${d.timestamp}
- **Performance**: TPS: ${d.tps} | Tick Duration: ${d.tickDurationMs.toFixed(3)}ms
- **Populations**:
  - Plants: ${d.populations.plants}
  - Herbivores: ${d.populations.herbivores}
  - Carnivores: ${d.populations.carnivores}
  - Fungi: ${d.populations.fungi}
  - Total Living: ${d.populations.totalLiving} | Total Biomass: ${Math.round(d.populations.totalBiomass)}
- **Ecological Vitals**:
  - Predator/Prey Ratio: ${d.vitals.predatorPreyRatio.toFixed(3)}
  - Avg Energy: ${d.vitals.avgEnergy.toFixed(1)} | Avg Health: ${d.vitals.avgHealth.toFixed(1)}
  - Biodiversity Index: ${d.vitals.biodiversityIndex.toFixed(2)}
  - Soil Moisture: ${(d.vitals.soilAverageMoisture * 100).toFixed(1)}% | Soil Nitrates: ${(d.vitals.soilAverageNitrates * 100).toFixed(1)}%
  - Arid Land: ${(d.vitals.aridLandPercentage * 100).toFixed(1)}%
- **Recent Anomalies**: ${d.recentAnomalies && d.recentAnomalies.length > 0 ? JSON.stringify(d.recentAnomalies, null, 2) : 'None (All systems nominal)'}
- **Selected Organism**: ${gardenState.selectedEntity ? JSON.stringify(gardenState.selectedEntity) : 'None'}
- **Request**: Please analyze the ecological stability, trophic balance, and recommend optimal curator interventions.`;
    }

    const pop = gardenState.populations;
    return `### Chaos Garden Simulation Health Report
- **Tick**: ${gardenState.tick} | **TPS**: ${gardenState.tps} | **Speed**: ${gardenState.speedMultiplier}x
- **Populations**: Plants: ${pop.plants}, Herbivores: ${pop.herbivores}, Carnivores: ${pop.carnivores}, Fungi: ${pop.fungi} (Total Living: ${pop.totalLiving})
- **Ecological Vitals**: Total Biomass: ${pop.totalBiomass}
- **Trophic Ratios**: Flora: ${(gardenState.plantRatio * 100).toFixed(1)}% | Herbivores: ${(gardenState.herbivoreRatio * 100).toFixed(1)}% | Predators: ${(gardenState.carnivoreRatio * 100).toFixed(1)}% | Decomposers: ${(gardenState.fungusRatio * 100).toFixed(1)}%
- **Selected Organism**: ${gardenState.selectedEntity ? JSON.stringify(gardenState.selectedEntity) : 'None'}
- **Request**: Please analyze the ecological stability, predator-prey dynamics, and recommend optimal curator interventions.`;
  }

  async function copyPrompt(): Promise<void> {
    const prompt = generatePrompt();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(prompt);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    }
  }
</script>

{#if curatorState.isDiagnosticsOpen}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <GlassPanel class="w-full max-w-lg p-6 flex flex-col gap-4 border-emerald-500/40 shadow-2xl pointer-events-auto">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">🤖</span>
          <div>
            <h3 class="font-bold text-base text-emerald-400">1-Click AI Diagnostic Export</h3>
            <p class="text-xs text-slate-400">Copy structured simulation context to pair with Claude, Gemini, or ChatGPT.</p>
            <p class="text-xs text-slate-400">Copy structured Flight Recorder context to pair with Claude, Gemini, or ChatGPT.</p>
          </div>
        </div>
        <button
          class="text-slate-400 hover:text-slate-200 text-lg font-bold"
          onclick={() => curatorState.toggleDiagnostics()}
        >
          ✕
        </button>
      </div>

      <!-- Preview Box -->
      <div class="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
        {generatePrompt()}
        {#if isLoading}
          <div class="text-slate-500 italic">Querying World Flight Recorder diagnostics...</div>
        {:else}
          {generatePrompt()}
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-1">
        <button
          class="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          onclick={() => curatorState.toggleDiagnostics()}
        >
          Dismiss
        </button>
        <button
          class="px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 {copied ? 'bg-emerald-600 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]'}"
          onclick={copyPrompt}
        >
          <span>{copied ? '✓' : '📋'}</span>
          <span>{copied ? 'Copied to Clipboard!' : 'Copy AI Diagnostic Prompt'}</span>
        </button>
      </div>
    </GlassPanel>
  </div>
{/if}

