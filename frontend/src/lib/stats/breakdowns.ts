import type { EventSeverityBreakdown, EventTypeBreakdown } from '@chaos-garden/shared';

export function renderEventBreakdownMarkup(eventBreakdown: EventTypeBreakdown[]): string {
  if (eventBreakdown.length === 0) {
    return '<p class="text-sm text-white/55">No simulation events in this window.</p>';
  }

  const maxCount = Math.max(...eventBreakdown.map((item) => item.count), 1);
  return eventBreakdown.map((item) => `
    <div>
      <div class="flex items-center justify-between text-xs text-white/70">
        <span>${item.eventType}</span>
        <span>${item.count}</span>
      </div>
      <div class="mt-1 h-2 rounded-full bg-white/10">
        <div class="h-2 rounded-full bg-gradient-to-r from-garden-green-300 to-garden-blue-300" style="width:${(item.count / maxCount) * 100}%"></div>
      </div>
    </div>
  `).join('');
}

export function renderSeverityBreakdownMarkup(severityBreakdown: EventSeverityBreakdown[]): string {
  const severityColor: Record<string, string> = {
    LOW: 'border-white/20 text-white/70',
    MEDIUM: 'border-yellow-300/40 text-yellow-100',
    HIGH: 'border-orange-300/50 text-orange-100',
    CRITICAL: 'border-red-300/60 text-red-100',
  };

  return severityBreakdown.map((item) => `
    <span class="rounded-md border px-2 py-1 text-xs ${severityColor[item.severity] ?? 'border-white/20 text-white/70'}">
      ${item.severity}: ${item.count}
    </span>
  `).join('');
}
