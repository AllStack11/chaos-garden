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

/**
 * Base color palettes for different herbivore types
 */
function getBaseColorForType(type: HerbivoreType, rng: SeededRandom): { base: string; pattern: string; accent: string } {
  const palettes: Record<HerbivoreType, { base: string[]; pattern: string[]; accent: string[] }> = {
    butterfly: {
      base: ['#e8d5b7', '#f5e6d3', '#fff8e7', '#ffe4c4'],
      pattern: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181'],
      accent: ['#aa96da', '#fcbad3', '#a8d8ea']
    },
    beetle: {
      base: ['#2d3436', '#636e72', '#1a1a2e', '#16213e'],
      pattern: ['#d4af37', '#c0a040', '#8b7355', '#708090'],
      accent: ['#e74c3c', '#3498db', '#9b59b6']
    },
    rabbit: {
      base: ['#d4c4a8', '#c9b896', '#e8dcc8', '#f0e6d2', '#8b7355'],
      pattern: ['#ffffff', '#f5f5f5', '#ffe4c4'],
      accent: ['#ffb6c1', '#ffc0cb']
    },
    snail: {
      base: ['#8b7355', '#a0826d', '#9c8869', '#b8a082'],
      pattern: ['#6b5344', '#5a4636'],
      accent: ['#98d8c8', '#7fcdbb']
    },
    cricket: {
      base: ['#4a5568', '#2d3748', '#3d4852', '#5a6978'],
      pattern: ['#68d391', '#9ae6b4', '#c6f6d5'],
      accent: ['#f6e05e', '#ecc94b']
    },
    ladybug: {
      base: ['#e53e3e', '#c53030', '#fc8181', '#feb2b2'],
      pattern: ['#1a202c', '#2d3748', '#171923'],
      accent: ['#1a202c']
    },
    grasshopper: {
      base: ['#68d391', '#48bb78', '#38a169', '#9ae6b4'],
      pattern: ['#f6e05e', '#d69e2e', '#b7791f'],
      accent: ['#ed8936', '#dd6b20']
    },
    ant: {
      base: ['#1a202c', '#2d3748', '#171923', '#0d1117'],
      pattern: ['#4a5568', '#718096'],
      accent: ['#e53e3e', '#dd6b20']
    },
    bee: {
      base: ['#f6e05e', '#ecc94b', '#faf089', '#f6e05e'],
      pattern: ['#1a202c', '#2d3748', '#171923'],
      accent: ['#f6ad55', '#ed8936']
    },
    moth: {
      base: ['#a0aec0', '#cbd5e0', '#e2e8f0', '#f7fafc'],
      pattern: ['#718096', '#4a5568', '#2d3748'],
      accent: ['#9f7aea', '#805ad5', '#b794f4']
    }
  };
  
  const palette = palettes[type];
  return {
    base: rng.choice(palette.base),
    pattern: rng.choice(palette.pattern),
    accent: rng.choice(palette.accent)
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
  const colors = getBaseColorForType(creatureType, rng);
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
    bodyPattern: ['solid', 'striped', 'spotted', 'banded'][rng.int(0, 3)] as CreaturePattern,
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
    shellColor: colors.accent[0],
    shellPattern: rng.next() > 0.5 ? 'striped' : 'solid',
    hasSpots: config.hasSpots,
    spotCount: rng.int(2, 7),
    spotColor: rng.choice(['#1a202c', '#2d3748', '#171923']),
    hasStripes: config.hasStripes,
    stripeCount: rng.int(3, 6),
    
    // Fluff/fur
    hasFur: config.hasFur,
    furDensity: rng.range(0.3, 0.8),
    hasFluffyEdges: rng.next() > 0.5,
    
    // Visual effects
    glowIntensity: config.glowIntensity * rng.range(0.5, 1.5),
    shimmerIntensity: rng.range(0, 0.3)
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
export function getHerbivoreColor(baseColor: string, visual: HerbivoreVisual): string {
  // For simple color strings, just return them as-is
  // This is a placeholder for more complex color manipulation if needed
  return baseColor;
}
import type { VisualGenome } from './types.ts';
import { getVisualGenome } from './VisualGenome.ts';
import { createWordTokenSet, hasAllTokens, hasAnyToken, pickDeterministicType } from './visualTypeClassifier.ts';
