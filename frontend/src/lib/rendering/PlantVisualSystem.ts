/**
 * Plant Visual System
 * 
 * Generates unique, persistent visual properties for each plant entity
 * based on its genetic makeup, ensuring each plant has a distinct appearance
 * that stays consistent across renders.
 */

interface Entity {
  id: string;
  name: string;
  species: string;
  health: number;
  energy: number;
  position: { x: number; y: number };
  traits: {
    photosynthesisRate: number;
    reproductionRate: number;
    metabolismEfficiency: number;
  };
}

interface PlantTraits {
  photosynthesisRate: number;
  reproductionRate: number;
  metabolismEfficiency: number;
}

/**
 * Plant visual categories based on species name characteristics
 */
export type PlantType = 
  | 'fern'
  | 'flower'
  | 'grass'
  | 'vine'
  | 'succulent'
  | 'lily'
  | 'moss'
  | 'cactus'
  | 'bush'
  | 'herb'
  | 'crystal'
  | 'coral'
  | 'kelp'
  | 'draconic';

/**
 * Leaf shape variations
 */
export type LeafShape = 'round' | 'pointed' | 'fern' | 'blade' | 'succulent';

/**
 * Pattern variations for flowers and leaves
 */
export type PatternType = 'solid' | 'spotted' | 'striped' | 'veined' | 'gradient';

/**
 * Complete visual properties for a plant
 */
export interface PlantVisual {
  // Identity
  plantType: PlantType;
  visualSeed: number;
  genome: VisualGenome;
  
  // Structural
  leafCount: number;
  leafShape: LeafShape;
  leafSize: number;
  
  // Bloom (for flowering plants)
  hasBloom: boolean;
  petalCount: number;
  petalShape: 'round' | 'pointed' | 'frilly';
  bloomSize: number;
  
  // Color properties
  baseHue: number;
  saturation: number;
  colorPattern: PatternType;
  
  // Structural
  stemThickness: number;
  stemCurvature: number;
  height: number;
  
  // Health/damage indicators
  droopFactor: number;
  spotIntensity: number;
  
  // Special features
  hasSpores: boolean;
  sporeColor: string;
  glowsAtNight: boolean;
  hasDewDrops: boolean;
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
 * Get plant type based on species name characteristics
 */
const PLANT_COLOR_OFFSET_SCHEMES: Record<PlantType, CreatureOffsetScheme> = {
  fern: { hueOffset: [-16, 8], saturationOffset: [-8, 18], lightnessOffset: [-8, 10] },
  flower: { hueOffset: [-30, 36], saturationOffset: [-12, 28], lightnessOffset: [-10, 14] },
  grass: { hueOffset: [-12, 14], saturationOffset: [-8, 16], lightnessOffset: [-8, 10] },
  vine: { hueOffset: [-18, 16], saturationOffset: [-10, 20], lightnessOffset: [-8, 10] },
  succulent: { hueOffset: [8, 52], saturationOffset: [-14, 18], lightnessOffset: [-10, 12] },
  lily: { hueOffset: [-22, 28], saturationOffset: [-10, 22], lightnessOffset: [-10, 14] },
  moss: { hueOffset: [-20, 6], saturationOffset: [-14, 10], lightnessOffset: [-10, 8] },
  cactus: { hueOffset: [4, 32], saturationOffset: [-18, 10], lightnessOffset: [-10, 8] },
  bush: { hueOffset: [-15, 12], saturationOffset: [-10, 16], lightnessOffset: [-8, 10] },
  herb: { hueOffset: [-10, 18], saturationOffset: [-6, 18], lightnessOffset: [-8, 12] },
  crystal: { hueOffset: [120, 240], saturationOffset: [10, 40], lightnessOffset: [10, 30] },
  coral: { hueOffset: [-60, 40], saturationOffset: [10, 30], lightnessOffset: [-5, 15] },
  kelp: { hueOffset: [-40, -10], saturationOffset: [-10, 20], lightnessOffset: [-15, 5] },
  draconic: { hueOffset: [0, 360], saturationOffset: [-20, 10], lightnessOffset: [-30, -10] },
};

function determinePlantType(name: string, species: string): PlantType {
  const tokens = createWordTokenSet(name, species);

  if (hasAnyToken(tokens, ['fern', 'frond', 'ancient'])) return 'fern';
  if (hasAnyToken(tokens, ['rose', 'lily', 'tulip'])) return 'lily';
  if (hasAnyToken(tokens, ['flower', 'petal', 'blossom'])) return 'flower';
  if (hasAnyToken(tokens, ['grass', 'wheat', 'reed'])) return 'grass';
  if (hasAnyToken(tokens, ['vine', 'climb', 'trail'])) return 'vine';
  if (hasAnyToken(tokens, ['cactus', 'spine', 'spiny'])) return 'cactus';
  if (hasAnyToken(tokens, ['succulent', 'thick', 'jade'])) return 'succulent';
  if (hasAnyToken(tokens, ['moss', 'creep', 'carpet'])) return 'moss';
  if (hasAnyToken(tokens, ['bush', 'shrub', 'bushy'])) return 'bush';
  if (hasAnyToken(tokens, ['herb', 'mint', 'thyme', 'basil'])) return 'herb';
  if (hasAnyToken(tokens, ['crystal', 'prism', 'shard', 'gem', 'facet', 'glitter'])) return 'crystal';
  if (hasAnyToken(tokens, ['coral', 'reef', 'fan', 'poly'])) return 'coral';
  if (hasAnyToken(tokens, ['kelp', 'seaweed', 'tangle', 'ribbon'])) return 'kelp';
  if (hasAnyToken(tokens, ['drake', 'dragon', 'spike', 'void', 'scale', 'dark'])) return 'draconic';

  const fallbackOrder: PlantType[] = [
    'fern',
    'flower',
    'grass',
    'vine',
    'succulent',
    'lily',
    'moss',
    'cactus',
    'bush',
    'herb',
  ];
  return pickDeterministicType(fallbackOrder, species, name);
}

/**
 * Generate persistent visual properties for a plant
 */
export function generatePlantVisual(entity: Entity): PlantVisual {
  const seed = generateVisualSeed(entity);
  const rng = new SeededRandom(seed);
  const traits = entity.traits as PlantTraits;
  const plantType = determinePlantType(entity.name, entity.species);
  const genome = getVisualGenome({
    id: entity.id,
    species: entity.species,
    type: 'plant',
    traits: {
      photosynthesisRate: traits.photosynthesisRate,
      reproductionRate: traits.reproductionRate,
      metabolismEfficiency: traits.metabolismEfficiency,
    },
  });
  
  // Base properties from type
  const typeConfigs: Record<PlantType, {
    leafCount: [number, number];
    leafShape: LeafShape[];
    hasBloom: boolean;
    petalCount: [number, number];
    stemThickness: [number, number];
    height: [number, number];
    glowsAtNight: boolean;
  }> = {
    fern: { leafCount: [5, 12], leafShape: ['fern'], hasBloom: false, petalCount: [0, 0], stemThickness: [0.5, 1.0], height: [1.2, 2.0], glowsAtNight: false },
    flower: { leafCount: [3, 8], leafShape: ['round', 'pointed'], hasBloom: true, petalCount: [5, 12], stemThickness: [0.8, 1.5], height: [0.8, 1.5], glowsAtNight: false },
    grass: { leafCount: [4, 10], leafShape: ['blade'], hasBloom: false, petalCount: [0, 0], stemThickness: [0.3, 0.6], height: [0.5, 1.2], glowsAtNight: false },
    vine: { leafCount: [3, 6], leafShape: ['round', 'blade'], hasBloom: true, petalCount: [3, 6], stemThickness: [0.4, 0.8], height: [1.0, 1.8], glowsAtNight: false },
    succulent: { leafCount: [3, 8], leafShape: ['succulent', 'round'], hasBloom: false, petalCount: [0, 0], stemThickness: [1.5, 2.5], height: [0.4, 0.8], glowsAtNight: true },
    lily: { leafCount: [2, 5], leafShape: ['pointed'], hasBloom: true, petalCount: [4, 8], stemThickness: [0.6, 1.2], height: [1.2, 2.0], glowsAtNight: false },
    moss: { leafCount: [8, 20], leafShape: ['round', 'fern'], hasBloom: false, petalCount: [0, 0], stemThickness: [0.2, 0.4], height: [0.2, 0.5], glowsAtNight: true },
    cactus: { leafCount: [1, 5], leafShape: ['succulent'], hasBloom: false, petalCount: [0, 0], stemThickness: [1.0, 2.0], height: [0.6, 1.5], glowsAtNight: false },
    bush: { leafCount: [6, 15], leafShape: ['round', 'pointed'], hasBloom: true, petalCount: [4, 8], stemThickness: [1.0, 2.0], height: [0.8, 1.5], glowsAtNight: false },
    herb: { leafCount: [4, 12], leafShape: ['round', 'pointed'], hasBloom: false, petalCount: [0, 0], stemThickness: [0.4, 0.8], height: [0.4, 0.9], glowsAtNight: false },
    crystal: { leafCount: [3, 7], leafShape: ['pointed'], hasBloom: false, petalCount: [0, 0], stemThickness: [1.2, 2.2], height: [0.6, 1.4], glowsAtNight: true },
    coral: { leafCount: [5, 12], leafShape: ['round'], hasBloom: false, petalCount: [0, 0], stemThickness: [1.5, 3.0], height: [0.5, 1.2], glowsAtNight: false },
    kelp: { leafCount: [1, 3], leafShape: ['blade'], hasBloom: false, petalCount: [0, 0], stemThickness: [0.6, 1.2], height: [1.5, 3.0], glowsAtNight: false },
    draconic: { leafCount: [4, 10], leafShape: ['pointed'], hasBloom: false, petalCount: [0, 0], stemThickness: [2.0, 4.0], height: [1.0, 2.2], glowsAtNight: true }
  };
  
  const config = typeConfigs[plantType];
  const traitInfluence = traits.photosynthesisRate;
  const colorOffsets = pickCreatureColorOffsets(rng, PLANT_COLOR_OFFSET_SCHEMES[plantType]);
  
  return {
    plantType,
    visualSeed: seed,
    genome,

    // Structural
    leafCount: rng.int(config.leafCount[0], config.leafCount[1]),
    leafShape: config.leafShape[rng.int(0, config.leafShape.length - 1)],
    leafSize: Math.min(rng.range(0.7, 1.3) * traitInfluence, 2.0),

    // Bloom
    hasBloom: config.hasBloom,
    petalCount: rng.int(config.petalCount[0], config.petalCount[1]),
    petalShape: rng.next() > 0.5 ? 'round' : 'pointed',
    bloomSize: Math.min(rng.range(0.7, 1.5) * traitInfluence, 2.5),
    
    // Color
    baseHue: colorOffsets.hueOffset,
    saturation: colorOffsets.saturationOffset,
    colorPattern: ['solid', 'spotted', 'striped', 'veined', 'gradient'][rng.int(0, 4)] as PatternType,
    
    // Structural
    stemThickness: rng.range(config.stemThickness[0], config.stemThickness[1]),
    stemCurvature: rng.range(-3, 3),
    height: rng.range(config.height[0], config.height[1]),
    
    // Health
    droopFactor: 1 - (entity.health / 100),
    spotIntensity: rng.range(0, 1),
    
    // Special
    hasSpores: plantType === 'fern' || plantType === 'moss',
    sporeColor: plantType === 'fern' ? 'rgba(200, 150, 100, 0.5)' : 'rgba(100, 200, 150, 0.5)',
    glowsAtNight: config.glowsAtNight || rng.next() > 0.9,
    hasDewDrops: plantType === 'succulent' || rng.next() > 0.85
  };
}

/**
 * Get HSL color adjusted by plant visual properties
 */
export function getPlantColor(baseHue: number, saturation: number, lightness: number, visual: PlantVisual): string {
  const hue = (baseHue + visual.baseHue + 360) % 360;
  const sat = Math.max(0, Math.min(100, saturation + visual.saturation));
  const light = Math.max(20, Math.min(80, lightness));
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/**
 * Get complementary accent color
 */
export function getPlantAccentColor(hue: number, visual: PlantVisual): string {
  const accentHue = (hue + visual.baseHue + 30 + 360) % 360;
  return `hsl(${accentHue}, 60%, 50%)`;
}

/**
 * Cached visuals for entities (persistent across renders)
 */
const visualCache = new Map<string, PlantVisual>();

/**
 * Get or create plant visual (cached for consistency)
 */
export function getPlantVisual(entity: Entity): PlantVisual {
  if (visualCache.has(entity.id)) {
    return visualCache.get(entity.id)!;
  }
  const visual = generatePlantVisual(entity);
  visualCache.set(entity.id, visual);
  return visual;
}

/**
 * Clear visual cache (useful for testing)
 */
export function clearVisualCache(): void {
  visualCache.clear();
}
import type { VisualGenome } from './types.ts';
import { getVisualGenome } from './VisualGenome.ts';
import { createWordTokenSet, hasAnyToken, pickDeterministicType } from './visualTypeClassifier.ts';
import { pickCreatureColorOffsets, type CreatureOffsetScheme } from './utils/creatureColorSchemes.ts';
