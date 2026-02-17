import type { GardenStatsPoint } from '@chaos-garden/shared';

export function renderMoversMarkup(history: GardenStatsPoint[]): string {
  if (history.length < 2) {
    return '<p class="text-sm text-white/60">Not enough history for movers yet.</p>';
  }

  const latest = history[history.length - 1];
  const getDeltaFromWindow = (windowSize: number, metric: keyof GardenStatsPoint['populations']) => {
    const startIndex = Math.max(0, history.length - windowSize);
    const start = history[startIndex];
    return latest.populations[metric] - start.populations[metric];
  };

  const metrics: Array<{ label: string; key: keyof GardenStatsPoint['populations'] }> = [
    { label: 'Plants', key: 'plants' },
    { label: 'Herbivores', key: 'herbivores' },
    { label: 'Carnivores', key: 'carnivores' },
    { label: 'Fungi', key: 'fungi' },
    { label: 'Living', key: 'living' },
    { label: 'Dead', key: 'dead' },
  ];

  const movers = metrics
    .map((metric) => ({
      label: metric.label,
      delta10: getDeltaFromWindow(10, metric.key),
      delta30: getDeltaFromWindow(30, metric.key),
    }))
    .sort((firstRow, secondRow) => Math.abs(secondRow.delta10) - Math.abs(firstRow.delta10));

  return `
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs uppercase tracking-[0.16em] text-white/55">
          <th class="pb-2">Metric</th>
          <th class="pb-2">Delta 10</th>
          <th class="pb-2">Delta 30</th>
        </tr>
      </thead>
      <tbody>
        ${movers
          .map((row) => {
            return `
          <tr class="border-t border-white/10 text-white/85">
            <td class="py-2">${row.label}</td>
            <td class="py-2 ${row.delta10 >= 0 ? 'text-[#b9f4bd]' : 'text-[#ffb7b7]'}">${row.delta10 >= 0 ? '+' : ''}${row.delta10}</td>
            <td class="py-2 ${row.delta30 >= 0 ? 'text-[#b9f4bd]' : 'text-[#ffb7b7]'}">${row.delta30 >= 0 ? '+' : ''}${row.delta30}</td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}
