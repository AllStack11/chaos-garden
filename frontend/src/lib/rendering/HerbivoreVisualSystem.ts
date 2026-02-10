/**
 * Herbivore Visual System
 * 
 * Generates unique, persistent visual properties for each herbivore entity
 * based on its genetic makeup and species characteristics, ensuring each
 * creature has a distinct appearance that stays consistent across renders.
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

interface HerbivoreTraits {
  reproductionRate: number;
  movementSpeed: number;
  metabolismEfficiency: number;
  perceptionRadius: number;
}

/**
 * Herbivore visual categories based on species name characteristics
 */
export type HerbivoreType = 
  | 'butterfly'
  | 'beetle'
  | 'rabbit'
  | 'snail'
  | 'cricket'
  | 'ladybug'
  | 'grasshopper'
  | 'ant'
  | 'bee'
  | 'moth';

/**
 * Body shape variations
 */
export type BodyShape = 'round' | 'elongated' | 'oval' | 'segmented' | 'compact';

/**
 * Pattern variations for creatures
 */
export type CreaturePattern = 'solid' | 'striped' | 'spotted' | 'banded' | 'gradient';

/**
 * Wing types for flying creatures
 */
export type WingType = 'transparent' | 'opaque' | 'patterned' | 'veined';

/**
 * Complete visual properties for a herbivore
 */
export interface HerbivoreVisual {
  // Identity
  creatureType: HerbivoreType;
  visualSeed: number;
  genome: VisualGenome;
  
  // Body
  bodyShape: BodyShape;
  bodySize: number;
  bodyColor: string;
  bodyPattern: CreaturePattern;
  patternColor: string;
  
  // Appendages
  hasWings: boolean;
  wingCount: number;
  wingType: WingType;
  wingSpan: number;
  hasAntenna: boolean;
  antennaLength: number;
  legCount: number;
  legLength: number;
  
  // Special features
  hasShell: boolean;
  shellColor: string;
  shellPattern: string;
  hasSpots: boolean;
  spotCount: number;
  spotColor: string;
  hasStripes: boolean;
  stripeCount: number;
  
  // Fluff/fur details
  hasFur: boolean;
  furDensity: number;
  hasFluffyEdges: boolean;
  
  // Visual effects
  glowIntensity: number;
  shimmerIntensity: number;
}

/**
 * Deterministic random number generator
 */
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
  
  choice<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

/**
 * Generate a deterministic visual seed from entity
 */
function generateVisualSeed(entity: Entity): number {
  const hash = entity.id.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return Math.abs(hash);
}

/**
 * Get herbivore type based on species name characteristics
 */
function determineHerbivoreType(name: string, species: string): HerbivoreType {
  const tokens = createWordTokenSet(name, species);

  if (hasAnyToken(tokens, ['butterfly', 'flutter', 'wing'])) return 'butterfly';
  if (hasAnyToken(tokens, ['beetle', 'armor', 'carapace', 'elytra'])) return 'beetle';
  if (
    hasAnyToken(tokens, ['rabbit', 'hare', 'bunny', 'mouse', 'mice', 'rodent', 'vole']) ||
    hasAllTokens(tokens, ['long', 'ear'])
  ) {
    return 'rabbit';
  }
  if (hasAnyToken(tokens, ['snail', 'slug', 'slow', 'spiral'])) return 'snail';
  if (hasAnyToken(tokens, ['cricket', 'chirp', 'jump'])) return 'cricket';
  if (hasAnyToken(tokens, ['ladybug', 'ladybird', 'spots', 'spotted'])) return 'ladybug';
  if (hasAnyToken(tokens, ['grasshopper', 'hopper', 'locust'])) return 'grasshopper';
  if (hasAnyToken(tokens, ['ant', 'worker', 'colony'])) return 'ant';
  if (hasAnyToken(tokens, ['bee', 'honey', 'stripe', 'striped', 'fuzzy', 'bumble'])) return 'bee';
  if (hasAnyToken(tokens, ['moth', 'night', 'dusty', 'nocturnal'])) return 'moth';

  const fallbackOrder: HerbivoreType[] = [
    'rabbit',
    'beetle',
    'grasshopper',
    'ant',
    'cricket',
    'snail',
    'ladybug',
    'bee',
    'moth',
    'butterfly',
  ];
  return pickDeterministicType(fallbackOrder, species, name);
}

function getChaoticHslColor(
  rng: SeededRandom,
  minimumSaturation: number,
  maximumSaturation: number,
  minimumLightness: number,
  maximumLightness: number,
): string {
  const hue = Math.floor(rng.range(0, 360));
  const saturation = Math.floor(rng.range(minimumSaturation, maximumSaturation));
  const lightness = Math.floor(rng.range(minimumLightness, maximumLightness));
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getChaoticHerbivoreColors(rng: SeededRandom): {
  base: string;
  pattern: string;
  accent: string;
  detail: string;
} {
  return {
    base: getChaoticHslColor(rng, 18, 100, 18, 86),
    pattern: getChaoticHslColor(rng, 24, 100, 12, 88),
    accent: getChaoticHslColor(rng, 20, 100, 16, 92),
    detail: getChaoticHslColor(rng, 30, 100, 8, 94),
  };
}

/**
 * Generate persistent visual properties for a herbivore
 */
export function generateHerbivoreVisual(entity: Entity): HerbivoreVisual {
  const seed = generateVisualSeed(entity);
  const rng = new SeededRandom(seed);
  const traits = entity.traits as HerbivoreTraits;
  const creatureType = determineHerbivoreType(entity.name, entity.species);
  const colors = getChaoticHerbivoreColors(rng);
  const genome = getVisualGenome({
    id: entity.id,
    species: entity.species,
    type: 'herbivore',
    traits: {
      reproductionRate: traits.reproductionRate,
      movementSpeed: traits.movementSpeed,
      metabolismEfficiency: traits.metabolismEfficiency,
      perceptionRadius: traits.perceptionRadius,
    },
  });
  
  // Speed influences body shape (faster = sleeker)
  const speedInfluence = traits.movementSpeed / 3; // normalize around typical speed
  
  // Type-specific configurations
  const typeConfigs: Record<HerbivoreType, {
    bodyShape: BodyShape[];
    hasWings: boolean;
    wingCount: number;
    wingType: WingType[];
    hasAntenna: boolean;
    antennaLength: number;
    legCount: number;
    legLength: number;
    hasShell: boolean;
    hasFur: boolean;
    hasSpots: boolean;
    hasStripes: boolean;
    glowIntensity: number;
  }> = {
    butterfly: {
      bodyShape: ['elongated'],
      hasWings: true,
      wingCount: 4,
      wingType: ['transparent', 'patterned', 'veined'],
      hasAntenna: true,
      antennaLength: 0.4,
      legCount: 6,
      legLength: 0.2,
      hasShell: false,
      hasFur: false,
      hasSpots: true,
      hasStripes: false,
      glowIntensity: 0.1
    },
    beetle: {
      bodyShape: ['oval', 'segmented', 'compact'],
      hasWings: true,
      wingCount: 2,
      wingType: ['opaque'],
      hasAntenna: true,
      antennaLength: 0.3,
      legCount: 6,
      legLength: 0.25,
      hasShell: true,
      hasFur: false,
      hasSpots: true,
      hasStripes: false,
      glowIntensity: 0.15
    },
    rabbit: {
      bodyShape: ['round', 'oval'],
      hasWings: false,
      wingCount: 0,
      wingType: [],
      hasAntenna: false,
      antennaLength: 0,
      legCount: 4,
      legLength: 0.3,
      hasShell: false,
      hasFur: true,
      hasSpots: false,
      hasStripes: false,
      glowIntensity: 0.05
    },
    snail: {
      bodyShape: ['elongated', 'segmented'],
      hasWings: false,
      wingCount: 0,
      wingType: [],
      hasAntenna: true,
      antennaLength: 0.5,
      legCount: 0,
      legLength: 0,
      hasShell: true,
      hasFur: false,
      hasSpots: false,
      hasStripes: false,
      glowIntensity: 0.2
    },
    cricket: {
      bodyShape: ['elongated', 'oval'],
      hasWings: true,
      wingCount: 2,
      wingType: ['veined'],
      hasAntenna: true,
      antennaLength: 0.8,
      legCount: 6,
      legLength: 0.5,
      hasShell: false,
      hasFur: false,
      hasSpots: true,
      hasStripes: true,
      glowIntensity: 0.1
    },
    ladybug: {
      bodyShape: ['round', 'oval'],
      hasWings: true,
      wingCount: 2,
      wingType: ['opaque'],
      hasAntenna: true,
      antennaLength: 0.15,
      legCount: 6,
      legLength: 0.15,
      hasShell: true,
      hasFur: false,
      hasSpots: true,
      hasStripes: false,
      glowIntensity: 0.1
    },
    grasshopper: {
      bodyShape: ['elongated'],
      hasWings: true,
      wingCount: 2,
      wingType: ['opaque', 'veined'],
      hasAntenna: true,
      antennaLength: 0.6,
      legCount: 6,
      legLength: 0.7,
      hasShell: false,
      hasFur: false,
      hasSpots: false,
      hasStripes: true,
      glowIntensity: 0.05
    },
    ant: {
      bodyShape: ['segmented', 'elongated'],
      hasWings: false,
      wingCount: 0,
      wingType: [],
      hasAntenna: true,
      antennaLength: 0.5,
      legCount: 6,
      legLength: 0.2,
      hasShell: false,
      hasFur: false,
      hasSpots: false,
      hasStripes: true,
      glowIntensity: 0.05
    },
    bee: {
      bodyShape: ['round', 'oval'],
      hasWings: true,
      wingCount: 4,
      wingType: ['transparent', 'patterned'],
      hasAntenna: true,
      antennaLength: 0.25,
      legCount: 6,
      legLength: 0.2,
      hasShell: false,
      hasFur: true,
      hasSpots: false,
      hasStripes: true,
      glowIntensity: 0.15
    },
    moth: {
      bodyShape: ['round', 'oval'],
      hasWings: true,
      wingCount: 4,
      wingType: ['transparent', 'patterned', 'veined'],
      hasAntenna: true,
      antennaLength: 0.4,
      legCount: 6,
      legLength: 0.2,
      hasShell: false,
      hasFur: true,
      hasSpots: true,
      hasStripes: false,
      glowIntensity: 0.25
    }
  };
  
  const config = typeConfigs[creatureType];
  
  return {
    creatureType,
    visualSeed: seed,
    genome,
    
    // Body
    bodyShape: rng.choice(config.bodyShape),
    bodySize: rng.range(0.7, 1.3) * (0.8 + speedInfluence * 0.4),
    bodyColor: colors.base,
    bodyPattern: ['solid', 'striped', 'spotted', 'banded', 'gradient'][rng.int(0, 4)] as CreaturePattern,
    patternColor: colors.pattern,
    
    // Appendages
    hasWings: config.hasWings,
    wingCount: config.wingCount,
    wingType: rng.choice(config.wingType),
    wingSpan: rng.range(0.8, 1.5),
    hasAntenna: config.hasAntenna,
    antennaLength: config.antennaLength * rng.range(0.8, 1.2),
    legCount: config.legCount,
    legLength: config.legLength * rng.range(0.8, 1.2),
    
    // Special features
    hasShell: config.hasShell,
    shellColor: colors.accent,
    shellPattern: ['solid', 'striped', 'spotted', 'banded'][rng.int(0, 3)],
    hasSpots: config.hasSpots,
    spotCount: rng.int(1, 12),
    spotColor: colors.detail,
    hasStripes: config.hasStripes,
    stripeCount: rng.int(1, 10),
    
    // Fluff/fur
    hasFur: config.hasFur,
    furDensity: rng.range(0.3, 0.8),
    hasFluffyEdges: rng.next() > 0.5,
    
    // Visual effects
    glowIntensity: config.glowIntensity * rng.range(0.2, 2.2),
    shimmerIntensity: rng.range(0, 0.8)
  };
}

/**
 * Cached visuals for entities (persistent across renders)
 */
const visualCache = new Map<string, HerbivoreVisual>();

/**
 * Get or create herbivore visual (cached for consistency)
 */
export function getHerbivoreVisual(entity: Entity): HerbivoreVisual {
  if (visualCache.has(entity.id)) {
    return visualCache.get(entity.id)!;
  }
  const visual = generateHerbivoreVisual(entity);
  visualCache.set(entity.id, visual);
  return visual;
}

/**
 * Clear visual cache (useful for testing)
 */
export function clearHerbivoreVisualCache(): void {
  visualCache.clear();
}

/**
 * Get HSL color adjusted by herbivore visual properties
 */
export function getHerbivoreColor(baseColor: string, _visual: HerbivoreVisual): string {
  // For simple color strings, just return them as-is
  // This is a placeholder for more complex color manipulation if needed
  return baseColor;
}
import type { VisualGenome } from './types.ts';
import { getVisualGenome } from './VisualGenome.ts';
import { createWordTokenSet, hasAllTokens, hasAnyToken, pickDeterministicType } from './visualTypeClassifier.ts';
