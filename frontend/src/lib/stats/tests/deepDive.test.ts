import { describe, expect, it } from 'vitest';
import {
  renderNittyGrittyMarkup,
  renderStoryCardsMarkup,
  renderTrendDigestMarkup,
  renderWeatherRhythmMarkup,
} from '../index';
import { buildHistoryPoint, buildStatsResponse } from './fixtures';

describe('lib/stats deep-dive renderers', () => {
  it('renders story cards from aggregate and history signals', () => {
    const stats = buildStatsResponse();
    const html = renderStoryCardsMarkup(stats);

    expect(html).toContain('Ecosystem Arc');
    expect(html).toContain('Climate Mood');
    expect(html).toContain('Predator Tension');
  });

  it('renders nitty-gritty table with low-level metrics', () => {
    const stats = buildStatsResponse();
    const html = renderNittyGrittyMarkup(stats);

    expect(html).toContain('Tick Window');
    expect(html).toContain('Biodiversity Index');
    expect(html).toContain('Temp Slope');
  });

  it('renders weather rhythm histogram', () => {
    const stats = buildStatsResponse();
    const html = renderWeatherRhythmMarkup(stats.history);

    expect(html).toContain('ticks');
    expect(html).toContain('CLEAR');
  });

  it('renders trend digest table for history windows', () => {
    const history = [
      buildHistoryPoint(1),
      buildHistoryPoint(2),
      buildHistoryPoint(3),
      buildHistoryPoint(4),
      buildHistoryPoint(5),
      buildHistoryPoint(6),
    ];

    const html = renderTrendDigestMarkup(history);
    expect(html).toContain('Delta 5');
    expect(html).toContain('Living');
  });

  it('returns fallback when weather history is empty or too short for trend digest', () => {
    expect(renderWeatherRhythmMarkup([])).toContain('No weather history');
    expect(renderTrendDigestMarkup([buildHistoryPoint(1)])).toContain('Not enough samples');
  });
});
