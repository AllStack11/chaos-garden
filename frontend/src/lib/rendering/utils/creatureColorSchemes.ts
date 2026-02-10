export interface SeededRandomLike {
  range(min: number, max: number): number;
}

export interface HslColorRange {
  hue: readonly [number, number];
  saturation: readonly [number, number];
  lightness: readonly [number, number];
}

export interface CreatureColorScheme {
  base: HslColorRange;
  pattern: HslColorRange;
  accent: HslColorRange;
  detail?: HslColorRange;
}

export interface CreatureColorOffsets {
  hueOffset: number;
  saturationOffset: number;
  lightnessOffset: number;
}

export interface CreatureOffsetScheme {
  hueOffset: readonly [number, number];
  saturationOffset: readonly [number, number];
  lightnessOffset: readonly [number, number];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHue(hue: number): number {
  const wrappedHue = hue % 360;
  return wrappedHue < 0 ? wrappedHue + 360 : wrappedHue;
}

function pickInRange(random: SeededRandomLike, range: readonly [number, number]): number {
  return random.range(range[0], range[1]);
}

export function pickHslColor(random: SeededRandomLike, colorRange: HslColorRange): string {
  const hue = normalizeHue(Math.round(pickInRange(random, colorRange.hue)));
  const saturation = Math.round(clamp(pickInRange(random, colorRange.saturation), 0, 100));
  const lightness = Math.round(clamp(pickInRange(random, colorRange.lightness), 0, 100));
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function pickCreaturePalette(
  random: SeededRandomLike,
  scheme: CreatureColorScheme,
): {
  baseColor: string;
  patternColor: string;
  accentColor: string;
  detailColor: string;
} {
  return {
    baseColor: pickHslColor(random, scheme.base),
    patternColor: pickHslColor(random, scheme.pattern),
    accentColor: pickHslColor(random, scheme.accent),
    detailColor: pickHslColor(random, scheme.detail ?? scheme.pattern),
  };
}

export function pickCreatureColorOffsets(
  random: SeededRandomLike,
  scheme: CreatureOffsetScheme,
): CreatureColorOffsets {
  return {
    hueOffset: pickInRange(random, scheme.hueOffset),
    saturationOffset: pickInRange(random, scheme.saturationOffset),
    lightnessOffset: pickInRange(random, scheme.lightnessOffset),
  };
}
