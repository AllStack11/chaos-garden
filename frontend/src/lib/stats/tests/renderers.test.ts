import { describe, expect, it } from 'vitest';
import {
  renderBiodiversityTrendMarkup,
  renderEnvironmentLinesMarkup,
  renderEventBreakdownMarkup,
  renderFoodWebPressureMarkup,
  renderInsightsMarkup,
  renderKpisMarkup,
  renderLivingDeadAreaMarkup,
  renderMoversMarkup,
  renderPopulationLinesMarkup,
  renderSeverityBreakdownMarkup,
  renderSpeciesMomentumMarkup,
  renderSpeciesShareMarkup,
  renderVitalsMarkup,
} from '../index';
import { buildStatsResponse } from './fixtures';

describe('lib/stats renderers', () => {
  it('renders KPI cards with key aggregate metrics', () => {
    const stats = buildStatsResponse();
    const html = renderKpisMarkup(stats);

    expect(html).toContain('Living Now');
    expect(html).toContain('Arc Delta');
    expect(html).toContain('Climate State');
  });

  it('renders vitals and insight cards', () => {
    const stats = buildStatsResponse();

    expect(renderVitalsMarkup(stats)).toContain('Average Living Energy');
    expect(renderInsightsMarkup(stats)).toContain('Stability window');
  });

  it('renders population/environment charts when history has enough samples', () => {
    const stats = buildStatsResponse();

    expect(renderPopulationLinesMarkup(stats.history)).toContain('<svg');
    expect(renderLivingDeadAreaMarkup(stats.history)).toContain('<svg');
    expect(renderEnvironmentLinesMarkup(stats.history)).toContain('Temperature');
    expect(renderBiodiversityTrendMarkup(stats.history)).toContain('Latest diversity index');
    expect(renderFoodWebPressureMarkup(stats.history)).toContain('Predator / Prey');
    expect(renderSpeciesMomentumMarkup(stats.history)).toContain('Plants');
  });

  it('renders species share donut and movers table', () => {
    const stats = buildStatsResponse();

    expect(renderSpeciesShareMarkup(stats.history[stats.history.length - 1])).toContain('Plants');
    expect(renderMoversMarkup(stats.history)).toContain('Delta 10');
  });

  it('renders event/severity breakdowns and handles empty severity safely', () => {
    const stats = buildStatsResponse();

    expect(renderEventBreakdownMarkup(stats.eventBreakdown)).toContain('BIRTH');
    expect(renderSeverityBreakdownMarkup(stats.severityBreakdown)).toContain('LOW');
    expect(renderSeverityBreakdownMarkup([])).toContain('No event severity data');
  });

  it('returns graceful fallback for insufficient history', () => {
    const stats = buildStatsResponse();
    const shortHistory = stats.history.slice(0, 1);

    expect(renderPopulationLinesMarkup(shortHistory)).toContain('Not enough history');
    expect(renderMoversMarkup(shortHistory)).toContain('Not enough history');
  });
});
