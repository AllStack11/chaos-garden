/**
 * Carnivore Visual System
 *
 * Generates deterministic, persistent visuals for carnivore entities.
 * Archetype selection uses species/name cues with deterministic fallback.
 */

interface Entity {
  id: string;
  name: string;
  species: string;
  health: number;
  energy: number;
  position: { x: number; y: number };
  traits: {
    reproductionRate: number;
    movementSpeed: number;
    metabolismEfficiency: number;
    perceptionRadius: number;
  };
}

interface CarnivoreTraits {
  reproductionRate: number;
  movementSpeed: number;
  metabolismEfficiency: number;
  perceptionRadius: number;
}

export type CarnivoreType = 'wolf' | 'raptor' | 'serpent';
export type CarnivorePatternType = 'solid' | 'striped' | 'spotted' | 'banded';

export interface CarnivoreVisual {
  predatorType: CarnivoreType;
  visualSeed: number;
  genome: VisualGenome;

  bodyScale: number;
  bodyLengthRatio: number;
  headSize: number;
  tailLength: number;

  legCount: number;
  legLength: number;
  stanceWidth: number;

  fangSize: number;
  clawSize: number;
  stingerLength: number;

  patternType: CarnivorePatternType;
  baseColor: string;
  accentColor: string;
  patternColor: string;

  eyeGlowIntensity: number;
  stealthShimmer: number;
  huntingAuraStrength: number;
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  choice<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}

function generateVisualSeed(entity: Entity): number {
  const hash = entity.id.split('').reduce((accumulator, character) => {
    return ((accumulator << 5) - accumulator) + character.charCodeAt(0);
  }, 0);
  return Math.abs(hash);
}

function determineCarnivoreType(entity: Entity): CarnivoreType {
  const tokens = createWordTokenSet(entity.name, entity.species);

  if (
    hasAnyToken(tokens, ['wolf', 'hound', 'night', 'shadow', 'hunt', 'stalk', 'howl'])
  ) {
    return 'wolf';
  }

  if (
    hasAnyToken(tokens, ['raptor', 'hawk', 'eagle', 'vulture', 'talon', 'sky', 'beak', 'dive', 'soar', 'glide'])
  ) {
    return 'raptor';
  }

  if (
    hasAnyToken(tokens, ['serpent', 'snake', 'cobra', 'viper', 'coil', 'slither', 'venom', 'hiss', 'drake', 'scourge'])
  ) {
    return 'serpent';
  }

  const fallbackOrder: CarnivoreType[] = ['wolf', 'raptor', 'serpent'];
  return pickDeterministicType(fallbackOrder, entity.species, entity.name);
}

const CARNIVORE_COLOR_SCHEMES: Record<CarnivoreType, CreatureColorScheme> = {
  wolf: {
    // Crimson Wolf - deep desaturated reds to charcoal
    base: { hue: [345, 10], saturation: [10, 30], lightness: [20, 40] },
    accent: { hue: [0, 20], saturation: [40, 60], lightness: [40, 55] },
    pattern: { hue: [340, 360], saturation: [10, 25], lightness: [10, 20] },
    detail: { hue: [0, 15], saturation: [30, 50], lightness: [15, 30] },
  },
  raptor: {
    // Scarlet Raptor - intense reds to dark plumes
    base: { hue: [350, 20], saturation: [60, 90], lightness: [30, 55] },
    accent: { hue: [340, 15], saturation: [70, 100], lightness: [50, 70] },
    pattern: { hue: [330, 10], saturation: [30, 60], lightness: [10, 25] },
    detail: { hue: [355, 25], saturation: [50, 90], lightness: [20, 40] },
  },
  serpent: {
    // Maroon Serpent - deep, dark, glossy reds to iridescent scales
    base: { hue: [330, 355], saturation: [30, 65], lightness: [15, 40] },
    accent: { hue: [345, 15], saturation: [50, 90], lightness: [40, 65] },
    pattern: { hue: [320, 350], saturation: [20, 55], lightness: [5, 20] },
    detail: { hue: [350, 20], saturation: [60, 100], lightness: [10, 30] },
  },
};

function getPalette(type: CarnivoreType, random: SeededRandom): {
  baseColor: string;
  accentColor: string;
  patternColor: string;
} {
  const palette = pickCreaturePalette(random, CARNIVORE_COLOR_SCHEMES[type]);
  return {
    baseColor: palette.baseColor,
    accentColor: palette.accentColor,
    patternColor: palette.patternColor,
  };
}

export function generateCarnivoreVisual(entity: Entity): CarnivoreVisual {
  const seed = generateVisualSeed(entity);
  const random = new SeededRandom(seed);
  const traits = entity.traits as CarnivoreTraits;
  const genome = getVisualGenome({
    id: entity.id,
    species: entity.species,
    type: 'carnivore',
    traits: {
      reproductionRate: traits.reproductionRate,
      movementSpeed: traits.movementSpeed,
      metabolismEfficiency: traits.metabolismEfficiency,
      perceptionRadius: traits.perceptionRadius,
    },
  });

  const predatorType = determineCarnivoreType(entity);
  const colors = getPalette(predatorType, random);

  const speedInfluence = Math.max(0.65, Math.min(1.45, traits.movementSpeed / 3));
  const perceptionInfluence = Math.max(0.7, Math.min(1.35, traits.perceptionRadius / 85));
  const metabolismInfluence = Math.max(0.75, Math.min(1.35, traits.metabolismEfficiency));
  const reproductionInfluence = Math.max(0.7, Math.min(1.3, traits.reproductionRate));
  const healthFactor = entity.health / 100;
  const energyFactor = entity.energy / 100;

  const typeConfig: Record<CarnivoreType, {
    legCount: number;
    bodyLengthRatio: [number, number];
    tailLength: [number, number];
    fangSize: [number, number];
    clawSize: [number, number];
    stingerLength: [number, number];
    shimmer: [number, number];
  }> = {
    wolf: {
      legCount: 4,
      bodyLengthRatio: [1.3, 1.7],
      tailLength: [0.8, 1.3],
      fangSize: [0.25, 0.45],
      clawSize: [0.25, 0.45],
      stingerLength: [0, 0],
      shimmer: [0.03, 0.12],
    },
    raptor: {
      legCount: 2,
      bodyLengthRatio: [0.8, 1.2],
      tailLength: [0.6, 1.1],
      fangSize: [0.4, 0.6], // Beak size
      clawSize: [0.5, 0.75], // Talon size
      stingerLength: [0, 0],
      shimmer: [0.05, 0.18],
    },
    serpent: {
      legCount: 0,
      bodyLengthRatio: [2.5, 4.0],
      tailLength: [0.5, 1.0],
      fangSize: [0.45, 0.65],
      clawSize: [0, 0],
      stingerLength: [0.3, 0.6], // Rattle or tail spike
      shimmer: [0.1, 0.25],
    },
  };

  const config = typeConfig[predatorType];

  return {
    predatorType,
    visualSeed: seed,
    genome,

    bodyScale: random.range(0.82, 1.24) * (0.84 + metabolismInfluence * 0.22),
    bodyLengthRatio: random.range(config.bodyLengthRatio[0], config.bodyLengthRatio[1]) * speedInfluence,
    headSize: random.range(0.72, 1.18) * (0.88 + perceptionInfluence * 0.16),
    tailLength: random.range(config.tailLength[0], config.tailLength[1]) * (0.86 + speedInfluence * 0.12),

    legCount: config.legCount,
    legLength: random.range(0.72, 1.3) * (0.82 + speedInfluence * 0.22),
    stanceWidth: random.range(0.75, 1.25) * (0.85 + perceptionInfluence * 0.15),

    fangSize: random.range(config.fangSize[0], config.fangSize[1]) * (0.8 + energyFactor * 0.25),
    clawSize: random.range(config.clawSize[0], config.clawSize[1]) * (0.8 + speedInfluence * 0.2),
    stingerLength: random.range(config.stingerLength[0], config.stingerLength[1]) * (0.8 + reproductionInfluence * 0.2),

    patternType: random.choice(['solid', 'striped', 'spotted', 'banded']),
    baseColor: colors.baseColor,
    accentColor: colors.accentColor,
    patternColor: colors.patternColor,

    eyeGlowIntensity: random.range(0.2, 0.8) * (0.7 + (1 - healthFactor) * 0.2 + energyFactor * 0.3),
    stealthShimmer: random.range(config.shimmer[0], config.shimmer[1]) * (0.8 + metabolismInfluence * 0.2),
    huntingAuraStrength: random.range(0.15, 0.7) * (0.7 + (1 - energyFactor) * 0.5),
  };
}

const visualCache = new Map<string, CarnivoreVisual>();

export function getCarnivoreVisual(entity: Entity): CarnivoreVisual {
  if (visualCache.has(entity.id)) {
    return visualCache.get(entity.id)!;
  }

  const visual = generateCarnivoreVisual(entity);
  visualCache.set(entity.id, visual);
  return visual;
}

export function clearCarnivoreVisualCache(): void {
  visualCache.clear();
}
import type { VisualGenome } from './types.ts';
import { getVisualGenome } from './VisualGenome.ts';
import { createWordTokenSet, hasAnyToken, pickDeterministicType } from './visualTypeClassifier.ts';
import { pickCreaturePalette, type CreatureColorScheme } from './utils/creatureColorSchemes.ts';
