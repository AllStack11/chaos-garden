import type { GardenStatsResponse } from '@chaos-garden/shared';

export function renderKpisMarkup(stats: GardenStatsResponse): string {
  const weatherLabel = stats.current.environment.weatherState?.currentState ?? 'N/A';
  const cards = [
    { label: 'Living Population', value: stats.current.populationSummary.totalLiving.toString(), hint: `Tick ${stats.current.tick}` },
    { label: 'Biodiversity', value: stats.derived.biodiversityIndex.toFixed(3), hint: 'Shannon-style index' },
    { label: 'Growth Velocity', value: `${stats.derived.growthRates.livingPerTick.toFixed(2)}/tick`, hint: `Delta ${stats.derived.deltas.living}` },
    { label: 'Mortality Pressure', value: `${(stats.derived.mortalityPressure * 100).toFixed(1)}%`, hint: 'Dead / Living ratio' },
    { label: 'Weather State', value: weatherLabel, hint: `Window ${stats.windowTicks} ticks` },
  ];

  return cards.map((card) => `
    <article class="kpi-card rounded-2xl border border-white/10 bg-black/30 p-4">
      <p class="text-[11px] uppercase tracking-[0.18em] text-white/55">${card.label}</p>
      <p class="mt-2 text-2xl font-semibold text-white">${card.value}</p>
      <p class="mt-1 text-xs text-white/50">${card.hint}</p>
    </article>
  `).join('');
}

export function renderVitalsMarkup(stats: GardenStatsResponse): string {
  const byType = stats.entityVitals.byType;
  const cards = [
    { title: 'Average Living Energy', value: `${stats.entityVitals.averageEnergyAcrossLiving.toFixed(1)}%` },
    { title: 'Average Living Health', value: `${stats.entityVitals.averageHealthAcrossLiving.toFixed(1)}%` },
    { title: 'Oldest Living Age', value: `${stats.entityVitals.oldestLivingAge} ticks` },
    { title: 'Young Cohort Count', value: `${stats.entityVitals.youngestCohortCount} entities` },
    { title: 'Plant Vitals', value: `${byType.plant.averageEnergy.toFixed(1)}E / ${byType.plant.averageHealth.toFixed(1)}H` },
    { title: 'Herbivore Vitals', value: `${byType.herbivore.averageEnergy.toFixed(1)}E / ${byType.herbivore.averageHealth.toFixed(1)}H` },
    { title: 'Carnivore Vitals', value: `${byType.carnivore.averageEnergy.toFixed(1)}E / ${byType.carnivore.averageHealth.toFixed(1)}H` },
    { title: 'Fungus Vitals', value: `${byType.fungus.averageEnergy.toFixed(1)}E / ${byType.fungus.averageHealth.toFixed(1)}H` },
  ];

  return cards.map((card) => `
    <div class="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div class="text-[11px] uppercase tracking-[0.18em] text-white/55">${card.title}</div>
      <div class="mt-2 text-lg font-semibold text-white">${card.value}</div>
    </div>
  `).join('');
}

export function renderInsightsMarkup(stats: GardenStatsResponse): string {
  if (stats.insights.length === 0) {
    return '<p class="text-sm text-white/55">No major signals triggered for this window.</p>';
  }

  const severityStyles: Record<string, string> = {
    LOW: 'border-white/20 bg-white/[0.04]',
    MEDIUM: 'border-yellow-300/30 bg-yellow-500/[0.08]',
    HIGH: 'border-orange-300/30 bg-orange-500/[0.08]',
    CRITICAL: 'border-red-300/35 bg-red-500/[0.08]',
  };

  return stats.insights.map((insight) => `
    <article class="rounded-xl border p-3 ${severityStyles[insight.severity] ?? severityStyles.LOW}">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-sm font-semibold text-white">${insight.title}</h3>
        <span class="rounded border border-white/20 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-white/80">${insight.severity}</span>
      </div>
      <p class="mt-2 text-sm text-white/75">${insight.description}</p>
      <div class="mt-2 text-xs text-white/60">Confidence ${(insight.confidence * 100).toFixed(0)}% • Ticks ${insight.tickRange.start}-${insight.tickRange.end}</div>
    </article>
  `).join('');
}
