import type { GardenStatsPoint } from '@chaos-garden/shared';

export function renderPopulationLinesMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '<p class="text-sm text-white/60">Not enough history to render trends yet.</p>';
  }

  const width = 780;
  const height = 280;
  const maxValue = Math.max(
    ...history.map((point) => {
      return Math.max(
        point.populations.plants,
        point.populations.herbivores,
        point.populations.carnivores,
        point.populations.fungi
      );
    }),
    1
  );

  const toPath = (values: number[]) => {
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * (width - 30) + 15;
        const y = height - ((value / maxValue) * (height - 26)) - 12;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const plants = history.map((point) => point.populations.plants);
  const herbivores = history.map((point) => point.populations.herbivores);
  const carnivores = history.map((point) => point.populations.carnivores);
  const fungi = history.map((point) => point.populations.fungi);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full overflow-visible">
      <defs>
        <linearGradient id="pop-grid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.15)"></stop>
          <stop offset="100%" stop-color="rgba(255,255,255,0.02)"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#pop-grid)"></rect>
      <polyline points="${toPath(plants)}" fill="none" stroke="#88c78f" stroke-width="2.4"></polyline>
      <polyline points="${toPath(herbivores)}" fill="none" stroke="#f2c38f" stroke-width="2.4"></polyline>
      <polyline points="${toPath(carnivores)}" fill="none" stroke="#ff9f9f" stroke-width="2.4"></polyline>
      <polyline points="${toPath(fungi)}" fill="none" stroke="#9ad6cb" stroke-width="2.4"></polyline>
    </svg>
    <div class="mt-3 flex flex-wrap gap-3 text-xs text-white/72">
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#88c78f]"></span> Plants</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#f2c38f]"></span> Herbivores</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#ff9f9f]"></span> Carnivores</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#9ad6cb]"></span> Fungi</span>
    </div>
  `;
}

export function renderSpeciesShareMarkup(current: GardenStatsPoint | null): string {
  if (!current) {
    return '';
  }

  const segments = [
    { label: 'Plants', value: current.populations.plants, color: '#88c78f' },
    { label: 'Herbivores', value: current.populations.herbivores, color: '#f2c38f' },
    { label: 'Carnivores', value: current.populations.carnivores, color: '#ff9f9f' },
    { label: 'Fungi', value: current.populations.fungi, color: '#9ad6cb' },
  ];
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let dashOffset = 0;

  const rings = segments
    .map((segment) => {
      const slice = (segment.value / total) * circumference;
      const ring = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="22" stroke-linecap="round" stroke-dasharray="${slice} ${circumference}" stroke-dashoffset="${-dashOffset}"></circle>`;
      dashOffset += slice;
      return ring;
    })
    .join('');

  return `
    <div class="flex items-center gap-5">
      <svg viewBox="0 0 160 160" class="h-44 w-44">
        <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="22"></circle>
        ${rings}
      </svg>
      <div class="space-y-2 text-sm text-white/82">
        ${segments
          .map((segment) => {
            return `<div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full" style="background:${segment.color}"></span>${segment.label}</span>
          <span>${((segment.value / total) * 100).toFixed(1)}%</span>
        </div>`;
          })
          .join('')}
      </div>
    </div>
  `;
}

export function renderLivingDeadAreaMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '';
  }

  const width = 620;
  const height = 220;
  const livingValues = history.map((point) => point.populations.living);
  const deadValues = history.map((point) => point.populations.dead);
  const maxValue = Math.max(
    ...livingValues.map((living, index) => {
      return living + deadValues[index];
    }),
    1
  );

  const toTopLine = (values: number[]) => {
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * (width - 20) + 10;
        const y = height - ((value / maxValue) * (height - 24)) - 12;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const toArea = (values: number[]) => {
    const points = toTopLine(values);
    return `${points} ${width - 10},${height - 10} 10,${height - 10}`;
  };

  const stackedValues = livingValues.map((living, index) => living + deadValues[index]);
  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full">
      <polygon points="${toArea(stackedValues)}" fill="rgba(255,159,159,0.2)"></polygon>
      <polygon points="${toArea(livingValues)}" fill="rgba(136,199,143,0.25)"></polygon>
      <polyline points="${toTopLine(stackedValues)}" fill="none" stroke="rgba(255,159,159,0.8)" stroke-width="2"></polyline>
      <polyline points="${toTopLine(livingValues)}" fill="none" stroke="rgba(136,199,143,0.9)" stroke-width="2"></polyline>
    </svg>
    <div class="mt-2 flex flex-wrap gap-3 text-xs text-white/72">
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#88c78f]"></span> Living</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#ff9f9f]"></span> Living + Dead</span>
    </div>
  `;
}

export function renderEnvironmentLinesMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '';
  }

  const width = 620;
  const height = 220;
  const normalize = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(0.0001, max - min);
    return values.map((value) => (value - min) / spread);
  };
  const temp = normalize(history.map((point) => point.environment.temperature));
  const sun = normalize(history.map((point) => point.environment.sunlight));
  const moisture = normalize(history.map((point) => point.environment.moisture));

  const toPath = (values: number[]) => {
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * (width - 18) + 9;
        const y = height - (value * (height - 22)) - 11;
        return `${x},${y}`;
      })
      .join(' ');
  };

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full">
      <polyline points="${toPath(temp)}" fill="none" stroke="#ffb38a" stroke-width="2"></polyline>
      <polyline points="${toPath(sun)}" fill="none" stroke="#9dd9f3" stroke-width="2"></polyline>
      <polyline points="${toPath(moisture)}" fill="none" stroke="#9ad6cb" stroke-width="2"></polyline>
    </svg>
    <div class="mt-2 flex flex-wrap gap-3 text-xs text-white/72">
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#ffb38a]"></span> Temperature</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#9dd9f3]"></span> Sunlight</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#9ad6cb]"></span> Moisture</span>
    </div>
  `;
}

function calculateBiodiversityIndex(point: GardenStatsPoint): number {
  const speciesCounts = [
    point.populations.plants,
    point.populations.herbivores,
    point.populations.carnivores,
    point.populations.fungi,
  ];
  const totalLiving = Math.max(1, point.populations.living);
  let index = 0;

  for (const count of speciesCounts) {
    if (count <= 0) {
      continue;
    }
    const proportion = count / totalLiving;
    index += -(proportion * Math.log(proportion));
  }

  return index;
}

export function renderBiodiversityTrendMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '<p class="text-sm text-white/60">Not enough history for biodiversity trend.</p>';
  }

  const values = history.map((point) => calculateBiodiversityIndex(point));
  const width = 620;
  const height = 220;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(0.0001, max - min);

  const pathPoints = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 18) + 9;
    const normalized = (value - min) / spread;
    const y = height - (normalized * (height - 22)) - 11;
    return `${x},${y}`;
  }).join(' ');

  const latest = values[values.length - 1];

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full">
      <polyline points="${pathPoints}" fill="none" stroke="#d8b4fe" stroke-width="2.2"></polyline>
    </svg>
    <p class="mt-2 text-xs text-white/70">Latest diversity index: ${latest.toFixed(3)}</p>
  `;
}

export function renderFoodWebPressureMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '<p class="text-sm text-white/60">Not enough history for food-web pressure.</p>';
  }

  const width = 620;
  const height = 220;
  const predatorPrey = history.map((point) => point.populations.carnivores / Math.max(1, point.populations.herbivores));
  const decomposition = history.map((point) => point.populations.dead / Math.max(1, point.populations.fungi));
  const combined = [...predatorPrey, ...decomposition];
  const maxValue = Math.max(...combined, 1);

  const toPath = (values: number[]) => values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 18) + 9;
    const y = height - ((value / maxValue) * (height - 22)) - 11;
    return `${x},${y}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full">
      <polyline points="${toPath(predatorPrey)}" fill="none" stroke="#fca5a5" stroke-width="2"></polyline>
      <polyline points="${toPath(decomposition)}" fill="none" stroke="#86efac" stroke-width="2"></polyline>
    </svg>
    <div class="mt-2 flex flex-wrap gap-3 text-xs text-white/70">
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#fca5a5]"></span> Predator / Prey</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#86efac]"></span> Dead / Fungi</span>
    </div>
  `;
}

export function renderSpeciesMomentumMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '<p class="text-sm text-white/60">Not enough history for momentum bars.</p>';
  }

  const latest = history[history.length - 1];
  const prior = history[Math.max(0, history.length - 11)];

  const rows = [
    { label: 'Plants', delta: latest.populations.plants - prior.populations.plants, color: '#4ade80' },
    { label: 'Herbivores', delta: latest.populations.herbivores - prior.populations.herbivores, color: '#facc15' },
    { label: 'Carnivores', delta: latest.populations.carnivores - prior.populations.carnivores, color: '#f87171' },
    { label: 'Fungi', delta: latest.populations.fungi - prior.populations.fungi, color: '#c084fc' },
    { label: 'Living', delta: latest.populations.living - prior.populations.living, color: '#38bdf8' },
    { label: 'Dead', delta: latest.populations.dead - prior.populations.dead, color: '#fb923c' },
  ];

  const maxAbsDelta = Math.max(...rows.map((row) => Math.abs(row.delta)), 1);

  return rows.map((row) => {
    const widthPercent = (Math.abs(row.delta) / maxAbsDelta) * 100;
    return `
      <div>
        <div class="flex items-center justify-between text-xs text-white/75">
          <span>${row.label}</span>
          <span class="${row.delta >= 0 ? 'text-green-300' : 'text-red-300'}">${row.delta >= 0 ? '+' : ''}${row.delta}</span>
        </div>
        <div class="mt-1 h-2 rounded-full bg-white/10">
          <div class="h-2 rounded-full" style="width:${widthPercent}%;background:${row.color}"></div>
        </div>
      </div>
    `;
  }).join('');
}
