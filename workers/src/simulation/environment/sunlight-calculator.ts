/**
 * Sunlight Calculator
 * 
 * Calculates the sun's position and intensity throughout the day—
 * the celestial rhythm that drives photosynthesis and life itself.
 * 
 * Like the turning of the Earth, our garden experiences day and night,
 * with sunlight waxing and waning in predictable cycles.
 */

import { clampValueToRange } from './helpers';
import { TICKS_PER_DAY } from './constants';

/**
 * Calculate sunlight intensity for a given tick.
 * Simulates a day/night cycle with a sine wave pattern.
 * 
 * @param tick - Current simulation tick
 * @returns Sunlight intensity (0-1, where 0 is night and 1 is midday)
 */
export function calculateSunlightForTick(tick: number): number {
  // Simplified day/night cycle: peak at tick 48, night at ticks 0 and 96
  // This creates a sine wave from 0 to 1 over 96 ticks
  const normalizedTime = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;
  const angle = normalizedTime * Math.PI * 2 - Math.PI / 2;
  const sunlight = (Math.sin(angle) + 1) / 2;
  
  // Clamp to ensure valid range
  return clampValueToRange(sunlight, 0, 1);
}

/**
 * Check if it's currently daytime.
 * 
 * @param tick - Current simulation tick
 * @returns True if sunlight > 0.5 (more day than night)
 */
export function isDaytime(tick: number): boolean {
  return calculateSunlightForTick(tick) > 0.5;
}

/**
 * Get the current phase of day.
 * 
 * @param tick - Current simulation tick
 * @returns String describing the time of day
 */
export function getTimeOfDay(tick: number): 'night' | 'dawn' | 'day' | 'dusk' {
  const normalizedTime = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;

  if (normalizedTime < 0.125 || normalizedTime >= 0.875) return 'night';
  if (normalizedTime < 0.375) return 'dawn';
  if (normalizedTime < 0.625) return 'day';
  return 'dusk';
}

/**
 * Calculate the percentage of daylight remaining.
 * 
 * @param tick - Current simulation tick
 * @returns Percentage (0-100) of daylight remaining in current cycle
 */
export function calculateDaylightRemainingPercentage(tick: number): number {
  const sunlight = calculateSunlightForTick(tick);
  
  // If it's nighttime, return 0
  if (sunlight <= 0.5) {
    return 0;
  }
  
  // Calculate how far we are through the daylight portion
  // Sunlight goes from 0.5 to 1.0 and back to 0.5 during daylight
  const daylightProgress = (sunlight - 0.5) * 2;
  return Math.round((1 - daylightProgress) * 100);
}
