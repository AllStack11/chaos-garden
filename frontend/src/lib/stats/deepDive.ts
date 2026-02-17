import type { GardenStatsPoint, GardenStatsResponse, WeatherStateName } from '@chaos-garden/shared';

function formatSigned(value: number, fractionDigits: number = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(fractionDigits)}`;
}

function formatPercent(value: number, fractionDigits: number = 1): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function getWeatherLabel(weatherState: WeatherStateName | null): string {
  if (!weatherState) {
    return 'Unknown';
  }
  return weatherState.replace('_', ' ');
}

function getWeatherCounts(history: GardenStatsPoint[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const point of history) {
    const key = getWeatherLabel(point.environment.weatherState);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function getPeakLivingPoint(history: GardenStatsPoint[]): GardenStatsPoint | null {
  if (history.length === 0) {
    return null;
  }

  return history.reduce((peakPoint, currentPoint) => {
    if (currentPoint.populations.living > peakPoint.populations.living) {
      return currentPoint;
    }
    return peakPoint;
  }, history[0]);
}

function getLowestLivingPoint(history: GardenStatsPoint[]): GardenStatsPoint | null {
  if (history.length === 0) {
    return null;
  }

  return history.reduce((lowestPoint, currentPoint) => {
    if (currentPoint.populations.living < lowestPoint.populations.living) {
      return currentPoint;
    }
    return lowestPoint;
  }, history[0]);
}

export function renderStoryCardsMarkup(stats: GardenStatsResponse): string {
  const history = stats.history;
  const latest = history[history.length - 1];
  const peakLivingPoint = getPeakLivingPoint(history);
  const lowestLivingPoint = getLowestLivingPoint(history);
  const weatherCounts = getWeatherCounts(history);

  const dominantWeatherEntry = Object.entries(weatherCounts).sort((firstEntry, secondEntry) => {
    return secondEntry[1] - firstEntry[1];
  })[0];

  const dominantWeatherLabel = dominantWeatherEntry ? dominantWeatherEntry[0] : 'Unknown';
  const dominantWeatherShare = dominantWeatherEntry
    ? dominantWeatherEntry[1] / Math.max(1, history.length)
    : 0;

  const cards = [
    {
      title: 'Ecosystem Arc',
      value: `${formatSigned(stats.derived.deltas.living, 0)} living`,
      detail: `Peak ${peakLivingPoint?.populations.living ?? 0} at tick ${peakLivingPoint?.tick ?? 0}; floor ${lowestLivingPoint?.populations.living ?? 0} at tick ${lowestLivingPoint?.tick ?? 0}.`,
    },
    {
      title: 'Climate Mood',
      value: dominantWeatherLabel,
      detail: `${formatPercent(dominantWeatherShare, 0)} of sampled ticks. Temp trend ${formatSigned(stats.derived.trendSlopes.temperature)} / tick.`,
    },
    {
      title: 'Predator Tension',
      value: `${stats.current.populationSummary.carnivores}:${stats.current.populationSummary.herbivores}`,
      detail: `Predator/prey ratio ${stats.derived.predatorPreyRatio.toFixed(2)}. Mortality pressure ${formatPercent(stats.derived.mortalityPressure)}.`,
    },
    {
      title: 'Decay Pipeline',
      value: `${stats.current.populationSummary.totalDead} corpses`,
      detail: `Fungi ${stats.current.populationSummary.fungi}. Decomposition pressure ${stats.derived.decompositionPressure.toFixed(2)}.`,
    },
    {
      title: 'Current Pulse',
      value: `Tick ${latest?.tick ?? stats.current.tick}`,
      detail: `Weather ${getWeatherLabel(latest?.environment.weatherState ?? stats.current.environment.weatherState?.currentState ?? null)}. Sun ${formatPercent(stats.current.environment.sunlight)}. Moisture ${formatPercent(stats.current.environment.moisture)}.`,
    },
  ];

  return cards
    .map((card) => {
      return `
      <article class="rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.11),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
        <p class="text-[10px] uppercase tracking-[0.24em] text-white/55">${card.title}</p>
        <p class="mt-2 text-xl font-semibold tracking-tight text-white">${card.value}</p>
        <p class="mt-2 text-xs leading-relaxed text-white/70">${card.detail}</p>
      </article>
    `;
    })
    .join('');
}

export function renderNittyGrittyMarkup(stats: GardenStatsResponse): string {
  const latest = stats.history[stats.history.length - 1] ?? null;
  const rows = [
    ['Tick Window', `${stats.windowTicks}`],
    ['History Points', `${stats.history.length}`],
    ['Living Delta', `${formatSigned(stats.derived.deltas.living, 0)}`],
    ['Dead Delta', `${formatSigned(stats.derived.deltas.dead, 0)}`],
    ['Living Growth / Tick', `${formatSigned(stats.derived.growthRates.livingPerTick)}`],
    ['Dead Growth / Tick', `${formatSigned(stats.derived.growthRates.deadPerTick)}`],
    ['Population Volatility', `${stats.derived.populationVolatility.toFixed(3)}`],
    ['Biodiversity Index', `${stats.derived.biodiversityIndex.toFixed(3)}`],
    ['Predator/Prey Ratio', `${stats.derived.predatorPreyRatio.toFixed(3)}`],
    ['Decomposition Pressure', `${stats.derived.decompositionPressure.toFixed(3)}`],
    ['Avg Temperature', `${stats.derived.averageEnvironment.temperature.toFixed(2)} C`],
    ['Avg Sunlight', `${formatPercent(stats.derived.averageEnvironment.sunlight)}`],
    ['Avg Moisture', `${formatPercent(stats.derived.averageEnvironment.moisture)}`],
    ['Temp Slope', `${formatSigned(stats.derived.trendSlopes.temperature)}`],
    ['Sunlight Slope', `${formatSigned(stats.derived.trendSlopes.sunlight)}`],
    ['Moisture Slope', `${formatSigned(stats.derived.trendSlopes.moisture)}`],
    ['Latest Weather', `${getWeatherLabel(latest?.environment.weatherState ?? stats.current.environment.weatherState?.currentState ?? null)}`],
    ['Oldest Living Age', `${stats.entityVitals.oldestLivingAge}`],
    ['Youngest Living Age', `${stats.entityVitals.youngestLivingAge}`],
    ['Young Cohort Size', `${stats.entityVitals.youngestCohortCount}`],
  ];

  return `
    <div class="overflow-hidden rounded-2xl border border-white/15 bg-black/20">
      <table class="w-full text-sm">
        <tbody>
          ${rows
            .map(([metricName, metricValue], index) => {
              return `
              <tr class="${index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}">
                <th class="w-1/2 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">${metricName}</th>
                <td class="px-3 py-2 text-right font-mono text-white/85">${metricValue}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderWeatherRhythmMarkup(history: GardenStatsPoint[]): string {
  if (history.length === 0) {
    return '<p class="text-sm text-white/60">No weather history available.</p>';
  }

  const weatherCounts = getWeatherCounts(history);
  const maxCount = Math.max(...Object.values(weatherCounts), 1);

  return Object.entries(weatherCounts)
    .sort((firstEntry, secondEntry) => secondEntry[1] - firstEntry[1])
    .map(([weatherLabel, count]) => {
      return `
      <div>
        <div class="flex items-center justify-between text-xs text-white/75">
          <span>${weatherLabel}</span>
          <span>${count} ticks</span>
        </div>
        <div class="mt-1 h-2 rounded-full bg-white/10">
          <div class="h-2 rounded-full bg-gradient-to-r from-[#88c78f] to-[#9ad6cb]" style="width:${(count / maxCount) * 100}%"></div>
        </div>
      </div>
    `;
    })
    .join('');
}

export function renderTrendDigestMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '<p class="text-sm text-white/60">Not enough samples for trend digest.</p>';
  }

  const latest = history[history.length - 1];
  const sampleSizes = [5, 15, 30];

  const trendRows = sampleSizes.map((sampleSize) => {
    const startIndex = Math.max(0, history.length - sampleSize);
    const startPoint = history[startIndex];

    return {
      label: `Delta ${sampleSize}`,
      living: latest.populations.living - startPoint.populations.living,
      dead: latest.populations.dead - startPoint.populations.dead,
      plants: latest.populations.plants - startPoint.populations.plants,
      herbivores: latest.populations.herbivores - startPoint.populations.herbivores,
      carnivores: latest.populations.carnivores - startPoint.populations.carnivores,
      fungi: latest.populations.fungi - startPoint.populations.fungi,
    };
  });

  return `
    <table class="w-full text-xs">
      <thead>
        <tr class="text-left uppercase tracking-[0.14em] text-white/55">
          <th class="pb-2">Window</th>
          <th class="pb-2">Living</th>
          <th class="pb-2">Dead</th>
          <th class="pb-2">Plants</th>
          <th class="pb-2">Herbivores</th>
          <th class="pb-2">Carnivores</th>
          <th class="pb-2">Fungi</th>
        </tr>
      </thead>
      <tbody>
        ${trendRows
          .map((row) => {
            return `
            <tr class="border-t border-white/10 text-white/85">
              <td class="py-2 font-medium">${row.label}</td>
              <td class="py-2 ${row.living >= 0 ? 'text-[#b9f4bd]' : 'text-[#ffb7b7]'}">${row.living >= 0 ? '+' : ''}${row.living}</td>
              <td class="py-2 ${row.dead >= 0 ? 'text-[#ffd7a3]' : 'text-[#9dd9f3]'}">${row.dead >= 0 ? '+' : ''}${row.dead}</td>
              <td class="py-2">${row.plants >= 0 ? '+' : ''}${row.plants}</td>
              <td class="py-2">${row.herbivores >= 0 ? '+' : ''}${row.herbivores}</td>
              <td class="py-2">${row.carnivores >= 0 ? '+' : ''}${row.carnivores}</td>
              <td class="py-2">${row.fungi >= 0 ? '+' : ''}${row.fungi}</td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}
