/**
 * Color Utilities for Entity Rendering
 * 
 * Provides HSL-based color manipulation for organic, biological-feeling
 * entity coloration with support for health states, energy levels,
 * and day/night color shifts.
 */

export interface EntityColors {
  base: { h: number; s: number; l: number };
  accent: { h: number; s: number; l: number };
  glow: { h: number; s: number; l: number; a: number };
  night: { h: number; s: number; l: number };
  shadow: { h: number; s: number; l: number };
}

export interface ColorPalette {
  primary: EntityColors;
  secondary: EntityColors;
  tertiary: EntityColors;
}

/**
 * Generate base colors for a species based on its name hash
 * Creates consistent, beautiful color schemes from entity names
 */
export function generateEntityColors(
  name: string, 
  speciesType: 'plant' | 'herbivore' | 'carnivore' | 'fungus'
): EntityColors {
  // Create a hash from the name for consistency
  const hash = hashString(name);
  
  // Base hue ranges per type for biological coherence
  const typeHueRanges: Record<string, [number, number]> = {
    plant: [70, 160],        // Greens to teals
    herbivore: [30, 60],     // Warm yellows to oranges
    carnivore: [0, 25],      // Reds to browns
    fungus: [260, 320]       // Purples to magentas
  };
  
  const [minHue, maxHue] = typeHueRanges[speciesType];
  const baseHue = minHue + (hash % (maxHue - minHue));
  
  // Saturation varies by health and energy
  const baseSat = 58 + (hash % 27); // 58-85%
  const baseLight = 45 + (hash % 20); // 45-65%
  
  // Accent is complementary, shifted
  const accentHue = (baseHue + 30) % 360;
  const accentSat = baseSat - 10;
  const accentLight = Math.min(70, baseLight + 15);
  
  // Glow is brighter version of base
  const glowHue = baseHue;
  const glowSat = baseSat + 10;
  const glowLight = Math.min(80, baseLight + 30);
  const glowAlpha = 0.3;
  
  // Night mode shifts toward blue-purple
  const nightHue = (baseHue + 180) % 360;
  const nightSat = baseSat - 20;
  const nightLight = baseLight - 10;
  
  // Shadow is dark version
  const shadowHue = baseHue;
  const shadowSat = baseSat - 30;
  const shadowLight = 15 + (hash % 10); // 15-25%
  
  return {
    base: { h: baseHue, s: baseSat, l: baseLight },
    accent: { h: accentHue, s: accentSat, l: accentLight },
    glow: { h: glowHue, s: glowSat, l: glowLight, a: glowAlpha },
    night: { h: nightHue, s: nightSat, l: nightLight },
    shadow: { h: shadowHue, s: shadowSat, l: shadowLight }
  };
}

/**
 * Get color adjusted for current health state
 */
export function getHealthAdjustedColor(
  colors: EntityColors,
  health: number, // 0-100
  energy: number // 0-100
): { fill: string; stroke: string } {
  const healthFactor = health / 100;
  const energyFactor = energy / 100;
  
  // Low health desaturates and darkens
  const saturationMod = healthFactor;
  const lightnessMod = 0.5 + (healthFactor * 0.5);
  
  // High energy brightens
  const energyBrightness = energyFactor * 0.2;
  
  const fillH = colors.base.h;
  const fillS = colors.base.s * saturationMod;
  const fillL = Math.min(70, colors.base.l * lightnessMod + energyBrightness * 30);
  
  const strokeH = colors.accent.h;
  const strokeS = colors.accent.s * saturationMod;
  const strokeL = Math.min(60, colors.accent.l * lightnessMod + energyBrightness * 20);
  
  return {
    fill: `hsl(${fillH}, ${fillS}%, ${fillL}%)`,
    stroke: `hsl(${strokeH}, ${strokeS}%, ${strokeL}%)`
  };
}

/**
 * Get night-mode adjusted color
 */
export function getNightColor(
  colors: EntityColors,
  isNight: boolean,
  isNocturnal: boolean
): { fill: string; glow: string } {
  if (!isNight) {
    return {
      fill: `hsl(${colors.base.h}, ${colors.base.s}%, ${colors.base.l}%)`,
      glow: `hsla(${colors.glow.h}, ${colors.glow.s}%, ${colors.glow.l}%, ${colors.glow.a})`
    };
  }
  
  // Nocturnal creatures embrace the night colors
  if (isNocturnal) {
    return {
      fill: `hsl(${colors.night.h}, ${colors.night.s}%, ${colors.night.l}%)`,
      glow: `hsla(${colors.night.h}, ${colors.night.s + 20}%, ${colors.night.l + 20}%, 0.6)`
    };
  }
  
  // Diurnal creatures become muted at night
  return {
    fill: `hsl(${colors.base.h}, ${colors.base.s * 0.5}%, ${colors.base.l * 0.7}%)`,
    glow: `hsla(${colors.glow.h}, ${colors.glow.s * 0.3}%, ${colors.glow.l * 0.5}%, ${colors.glow.a * 0.3})`
  };
}

/**
 * Get color for death/fading animation
 */
export function getDeathColor(
  colors: EntityColors,
  deathProgress: number // 0-1, where 1 is fully faded
): string {
  // Desaturate and fade to gray as death progresses
  const gray = 60 - (deathProgress * 40); // 60 -> 20
  const alpha = 1 - deathProgress;
  
  if (deathProgress > 0.7) {
    // Gray ghost phase
    return `hsla(0, 0%, ${gray}%, ${alpha})`;
  }
  
  // Desaturated original color
  return `hsla(${colors.base.h}, ${colors.base.s * (1 - deathProgress * 0.8)}%, ${colors.base.l}%, ${alpha})`;
}

/**
 * Generate random but coherent color palette for species
 */
export function generateColorPalette(
  speciesName: string
): ColorPalette {
  const primary = generateEntityColors(speciesName, 'plant');
  
  // Secondary is analogous color
  const secondaryH = (primary.base.h + 40) % 360;
  const secondary: EntityColors = {
    base: { h: secondaryH, s: primary.base.s - 10, l: primary.base.l - 5 },
    accent: { h: (secondaryH + 30) % 360, s: primary.accent.s, l: primary.accent.l },
    glow: { h: secondaryH, s: primary.glow.s, l: primary.glow.l + 10, a: primary.glow.a },
    night: { h: (secondaryH + 180) % 360, s: primary.night.s, l: primary.night.l },
    shadow: { h: secondaryH, s: primary.shadow.s, l: primary.shadow.l }
  };
  
  // Tertiary is contrasting
  const tertiaryH = (primary.base.h + 180) % 360;
  const tertiary: EntityColors = {
    base: { h: tertiaryH, s: primary.base.s - 15, l: primary.base.l + 10 },
    accent: { h: (tertiaryH + 30) % 360, s: primary.accent.s, l: primary.accent.l },
    glow: { h: tertiaryH, s: primary.glow.s, l: primary.glow.l, a: primary.glow.a * 0.5 },
    night: { h: (tertiaryH + 180) % 360, s: primary.night.s, l: primary.night.l },
    shadow: { h: tertiaryH, s: primary.shadow.s, l: primary.shadow.l }
  };
  
  return { primary, secondary, tertiary };
}

/**
 * Simple string hash function for deterministic color generation
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Interpolate between two colors
 */
export function lerpColor(
  color1: { h: number; s: number; l: number },
  color2: { h: number; s: number; l: number },
  t: number
): string {
  const h = color1.h + (color2.h - color1.h) * t;
  const s = color1.s + (color2.s - color1.s) * t;
  const l = color1.l + (color2.l - color1.l) * t;
  return `hsl(${h}, ${s}%, ${l}%)`;
}
