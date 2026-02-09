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

export type CarnivoreType = 'wolf' | 'fox' | 'bigCat';
export type CarnivorePatternType = 'solid' | 'striped' | 'spotted' | 'banded';

export interface CarnivoreVisual {
  predatorType: CarnivoreType;
  visualSeed: number;

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

function determineCarnivoreType(entity: Entity, random: SeededRandom): CarnivoreType {
  const normalizedName = entity.name.toLowerCase();
  const normalizedSpecies = entity.species.toLowerCase();

  if (
    normalizedSpecies.includes('wolf') ||
    normalizedSpecies.includes('hound') ||
    normalizedName.includes('night') ||
    normalizedName.includes('shadow') ||
    normalizedName.includes('hunt') ||
    normalizedName.includes('stalk')
  ) {
    return 'wolf';
  }

  if (
    normalizedSpecies.includes('fox') ||
    normalizedSpecies.includes('vulp') ||
    normalizedName.includes('claw') ||
    normalizedName.includes('sharp') ||
    normalizedName.includes('pounce')
  ) {
    return 'fox';
  }

  if (
    normalizedSpecies.includes('cat') ||
    normalizedSpecies.includes('lynx') ||
    normalizedSpecies.includes('tiger') ||
    normalizedSpecies.includes('panther') ||
    normalizedName.includes('fang') ||
    normalizedName.includes('blood') ||
    normalizedName.includes('roar')
  ) {
    return 'bigCat';
  }

  return random.choice(['wolf', 'fox', 'bigCat']);
}

function getPalette(type: CarnivoreType, random: SeededRandom): {
  baseColor: string;
  accentColor: string;
  patternColor: string;
} {
  const palettes: Record<CarnivoreType, { base: string[]; accent: string[]; pattern: string[] }> = {
    wolf: {
      base: ['#5f6368', '#7b8289', '#4c5159'],
      accent: ['#c9b08b', '#d8c2a0', '#e2d2bb'],
      pattern: ['#2a2d31', '#1f2328'],
    },
    fox: {
      base: ['#d56a3a', '#c95b2f', '#e37a42'],
      accent: ['#f4e7d5', '#ead7c0', '#fff3e6'],
      pattern: ['#5b2a1a', '#4a1f14'],
    },
    bigCat: {
      base: ['#c59b53', '#b78a47', '#d2a860'],
      accent: ['#f5dba3', '#f1cf85', '#fff0c8'],
      pattern: ['#3b291a', '#24180f'],
    },
  };

  const palette = palettes[type];
  return {
    baseColor: random.choice(palette.base),
    accentColor: random.choice(palette.accent),
    patternColor: random.choice(palette.pattern),
  };
}

export function generateCarnivoreVisual(entity: Entity): CarnivoreVisual {
  const seed = generateVisualSeed(entity);
  const random = new SeededRandom(seed);
  const traits = entity.traits as CarnivoreTraits;

  const predatorType = determineCarnivoreType(entity, random);
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
    fox: {
      legCount: 4,
      bodyLengthRatio: [1.2, 1.6],
      tailLength: [1.2, 1.8],
      fangSize: [0.2, 0.38],
      clawSize: [0.2, 0.38],
      stingerLength: [0, 0],
      shimmer: [0.08, 0.2],
    },
    bigCat: {
      legCount: 4,
      bodyLengthRatio: [1.35, 1.75],
      tailLength: [0.9, 1.4],
      fangSize: [0.32, 0.52],
      clawSize: [0.3, 0.5],
      stingerLength: [0, 0],
      shimmer: [0.04, 0.15],
    },
  };

  const config = typeConfig[predatorType];

  return {
    predatorType,
    visualSeed: seed,

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
