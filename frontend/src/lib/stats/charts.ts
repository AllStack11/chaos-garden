import type { GardenStatsPoint } from '@chaos-garden/shared';

export function renderPopulationLinesMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '<p class="text-sm text-white/60">Not enough history to render trends yet.</p>';
  }

  const width = 780;
  const height = 280;
  const maxValue = Math.max(...history.map((point) => Math.max(point.populations.plants, point.populations.herbivores, point.populations.carnivores, point.populations.fungi)), 1);
  const toPath = (values: number[]) => values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 30) + 15;
    const y = height - ((value / maxValue) * (height - 26)) - 12;
    return `${x},${y}`;
  }).join(' ');

  const plants = history.map((point) => point.populations.plants);
  const herbivores = history.map((point) => point.populations.herbivores);
  const carnivores = history.map((point) => point.populations.carnivores);
  const fungi = history.map((point) => point.populations.fungi);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full overflow-visible">
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
      <polyline points="${toPath(plants)}" fill="none" stroke="#4ade80" stroke-width="2.2"></polyline>
      <polyline points="${toPath(herbivores)}" fill="none" stroke="#facc15" stroke-width="2.2"></polyline>
      <polyline points="${toPath(carnivores)}" fill="none" stroke="#f87171" stroke-width="2.2"></polyline>
      <polyline points="${toPath(fungi)}" fill="none" stroke="#c084fc" stroke-width="2.2"></polyline>
    </svg>
    <div class="mt-3 flex flex-wrap gap-3 text-xs text-white/70">
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#4ade80]"></span> Plants</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#facc15]"></span> Herbivores</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#f87171]"></span> Carnivores</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#c084fc]"></span> Fungi</span>
    </div>
  `;
}

export function renderSpeciesShareMarkup(current: GardenStatsPoint | null): string {
  if (!current) {
    return '';
  }

  const segments = [
    { label: 'Plants', value: current.populations.plants, color: '#4ade80' },
    { label: 'Herbivores', value: current.populations.herbivores, color: '#facc15' },
    { label: 'Carnivores', value: current.populations.carnivores, color: '#f87171' },
    { label: 'Fungi', value: current.populations.fungi, color: '#c084fc' },
  ];
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let dashOffset = 0;

  const rings = segments.map((segment) => {
    const slice = (segment.value / total) * circumference;
    const ring = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="22" stroke-linecap="round" stroke-dasharray="${slice} ${circumference}" stroke-dashoffset="${-dashOffset}"></circle>`;
    dashOffset += slice;
    return ring;
  }).join('');

  return `
    <div class="flex items-center gap-5">
      <svg viewBox="0 0 160 160" class="h-44 w-44">
        <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="22"></circle>
        ${rings}
      </svg>
      <div class="space-y-2 text-sm text-white/80">
        ${segments.map((segment) => `<div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full" style="background:${segment.color}"></span>${segment.label}</span>
          <span>${((segment.value / total) * 100).toFixed(1)}%</span>
        </div>`).join('')}
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
  const maxValue = Math.max(...livingValues.map((living, index) => living + deadValues[index]), 1);

  const toTopLine = (values: number[]) => values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 20) + 10;
    const y = height - ((value / maxValue) * (height - 24)) - 12;
    return `${x},${y}`;
  }).join(' ');

  const toArea = (values: number[]) => {
    const points = toTopLine(values);
    return `${points} ${width - 10},${height - 10} 10,${height - 10}`;
  };

  const stackedValues = livingValues.map((living, index) => living + deadValues[index]);
  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full">
      <polygon points="${toArea(stackedValues)}" fill="rgba(248,113,113,0.18)"></polygon>
      <polygon points="${toArea(livingValues)}" fill="rgba(74,222,128,0.22)"></polygon>
      <polyline points="${toTopLine(stackedValues)}" fill="none" stroke="rgba(248,113,113,0.75)" stroke-width="2"></polyline>
      <polyline points="${toTopLine(livingValues)}" fill="none" stroke="rgba(74,222,128,0.85)" stroke-width="2"></polyline>
    </svg>
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

  const toPath = (values: number[]) => values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 18) + 9;
    const y = height - (value * (height - 22)) - 11;
    return `${x},${y}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full">
      <polyline points="${toPath(temp)}" fill="none" stroke="#fb923c" stroke-width="2"></polyline>
      <polyline points="${toPath(sun)}" fill="none" stroke="#38bdf8" stroke-width="2"></polyline>
      <polyline points="${toPath(moisture)}" fill="none" stroke="#34d399" stroke-width="2"></polyline>
    </svg>
    <div class="mt-2 flex flex-wrap gap-3 text-xs text-white/70">
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#fb923c]"></span> Temperature</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#38bdf8]"></span> Sunlight</span>
      <span><span class="inline-block h-2 w-2 rounded-full bg-[#34d399]"></span> Moisture</span>
    </div>
  `;
}
