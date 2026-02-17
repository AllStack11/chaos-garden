import type { EventSeverityBreakdown, EventTypeBreakdown } from '@chaos-garden/shared';

export function renderEventBreakdownMarkup(eventBreakdown: EventTypeBreakdown[]): string {
  if (eventBreakdown.length === 0) {
    return '<p class="text-sm text-white/60">No simulation events in this window.</p>';
  }

  const maxCount = Math.max(...eventBreakdown.map((item) => item.count), 1);
  return eventBreakdown
    .map((item) => {
      return `
      <div>
        <div class="flex items-center justify-between text-xs text-white/75">
          <span>${item.eventType}</span>
          <span>${item.count}</span>
        </div>
        <div class="mt-1 h-2 rounded-full bg-white/10">
          <div class="h-2 rounded-full bg-gradient-to-r from-[#88c78f] to-[#9dd9f3]" style="width:${(item.count / maxCount) * 100}%"></div>
        </div>
      </div>
    `;
    })
    .join('');
}

export function renderSeverityBreakdownMarkup(severityBreakdown: EventSeverityBreakdown[]): string {
  if (severityBreakdown.length === 0) {
    return '<p class="text-sm text-white/60">No event severity data in this window.</p>';
  }

  const severityColor: Record<string, string> = {
    LOW: 'border-white/25 text-white/75',
    MEDIUM: 'border-[#f2c38f]/50 text-[#f2c38f]',
    HIGH: 'border-[#ffb38a]/60 text-[#ffb38a]',
    CRITICAL: 'border-[#ff9f9f]/65 text-[#ff9f9f]',
  };

  return severityBreakdown
    .map((item) => {
      return `
      <span class="rounded-md border px-2 py-1 text-xs ${severityColor[item.severity] ?? 'border-white/25 text-white/75'}">
        ${item.severity}: ${item.count}
      </span>
    `;
    })
    .join('');
}
