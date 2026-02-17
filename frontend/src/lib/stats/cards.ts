import type { GardenStatsResponse } from '@chaos-garden/shared';

function formatSigned(value: number, fractionDigits: number = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(fractionDigits)}`;
}

export function renderKpisMarkup(stats: GardenStatsResponse): string {
  const weatherLabel = stats.current.environment.weatherState?.currentState ?? 'UNKNOWN';
  const cards = [
    {
      label: 'Living Now',
      value: stats.current.populationSummary.totalLiving.toString(),
      hint: `Dead matter ${stats.current.populationSummary.totalDead}`,
    },
    {
      label: 'Arc Delta',
      value: formatSigned(stats.derived.deltas.living, 0),
      hint: `${formatSigned(stats.derived.growthRates.livingPerTick)} / tick`,
    },
    {
      label: 'Diversity',
      value: stats.derived.biodiversityIndex.toFixed(3),
      hint: `Volatility ${stats.derived.populationVolatility.toFixed(2)}`,
    },
    {
      label: 'Mortality Load',
      value: `${(stats.derived.mortalityPressure * 100).toFixed(1)}%`,
      hint: `Decay pressure ${stats.derived.decompositionPressure.toFixed(2)}`,
    },
    {
      label: 'Climate State',
      value: weatherLabel,
      hint: `Temp slope ${formatSigned(stats.derived.trendSlopes.temperature)}`,
    },
  ];

  return cards
    .map((card) => {
      return `
      <article class="kpi-card rounded-2xl border border-white/15 bg-[linear-gradient(152deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
        <p class="text-[10px] uppercase tracking-[0.2em] text-white/55">${card.label}</p>
        <p class="mt-2 text-2xl font-semibold text-white">${card.value}</p>
        <p class="mt-1 text-xs text-white/65">${card.hint}</p>
      </article>
    `;
    })
    .join('');
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

  return cards
    .map((card) => {
      return `
      <div class="rounded-xl border border-white/15 bg-white/[0.04] p-3">
        <div class="text-[10px] uppercase tracking-[0.16em] text-white/55">${card.title}</div>
        <div class="mt-2 text-lg font-semibold text-white">${card.value}</div>
      </div>
    `;
    })
    .join('');
}

export function renderInsightsMarkup(stats: GardenStatsResponse): string {
  if (stats.insights.length === 0) {
    return '<p class="text-sm text-white/60">No deterministic alerts fired in this window.</p>';
  }

  const severityStyles: Record<string, string> = {
    LOW: 'border-[#9ad6cb]/35 bg-[#9ad6cb]/10',
    MEDIUM: 'border-[#f2c38f]/40 bg-[#f2c38f]/10',
    HIGH: 'border-[#ffb38a]/45 bg-[#ffb38a]/12',
    CRITICAL: 'border-[#ff9f9f]/55 bg-[#ff9f9f]/14',
  };

  return stats.insights
    .map((insight) => {
      return `
      <article class="rounded-xl border p-3 ${severityStyles[insight.severity] ?? severityStyles.LOW}">
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-sm font-semibold text-white">${insight.title}</h3>
          <span class="rounded border border-white/25 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/85">${insight.severity}</span>
        </div>
        <p class="mt-2 text-sm text-white/78">${insight.description}</p>
        <div class="mt-2 text-xs text-white/62">Confidence ${(insight.confidence * 100).toFixed(0)}% | Ticks ${insight.tickRange.start}-${insight.tickRange.end}</div>
      </article>
    `;
    })
    .join('');
}
