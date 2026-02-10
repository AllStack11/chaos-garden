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
  | 'herb';

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
function determinePlantType(name: string, species: string): PlantType {
  const combined = (name + ' ' + species).toLowerCase();
  
  if (combined.includes('fern') || combined.includes('frond') || combined.includes('ancient')) {
    return 'fern';
  }
  if (combined.includes('rose') || combined.includes('lily') || combined.includes('tulip')) {
    return 'lily';
  }
  if (combined.includes('flower') || combined.includes('petal') || combined.includes('blossom')) {
    return 'flower';
  }
  if (combined.includes('grass') || combined.includes('wheat') || combined.includes('reed')) {
    return 'grass';
  }
  if (combined.includes('vine') || combined.includes('climb') || combined.includes('trail')) {
    return 'vine';
  }
  if (combined.includes('cactus')) {
    return 'cactus';
  }
  if (combined.includes('succulent') || combined.includes('thick') || combined.includes('jade')) {
    return 'succulent';
  }
  if (combined.includes('moss') || combined.includes('creep') || combined.includes('carpet')) {
    return 'moss';
  }
  if (combined.includes('bush') || combined.includes('shrub') || combined.includes('bushy')) {
    return 'bush';
  }
  if (combined.includes('herb') || combined.includes('mint') || combined.includes('thyme')) {
    return 'herb';
  }
  
  // Default to flower type for variety
  return 'flower';
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
    herb: { leafCount: [4, 12], leafShape: ['round', 'pointed'], hasBloom: false, petalCount: [0, 0], stemThickness: [0.4, 0.8], height: [0.4, 0.9], glowsAtNight: false }
  };
  
  const config = typeConfigs[plantType];
  const traitInfluence = traits.photosynthesisRate;
  
  return {
    plantType,
    visualSeed: seed,
    genome,
    
    // Structural
    leafCount: rng.int(config.leafCount[0], config.leafCount[1]),
    leafShape: config.leafShape[rng.int(0, config.leafShape.length - 1)],
    leafSize: rng.range(0.7, 1.3) * traitInfluence,
    
    // Bloom
    hasBloom: config.hasBloom,
    petalCount: rng.int(config.petalCount[0], config.petalCount[1]),
    petalShape: rng.next() > 0.5 ? 'round' : 'pointed',
    bloomSize: rng.range(0.7, 1.5) * traitInfluence,
    
    // Color
    baseHue: rng.range(-20, 20),
    saturation: rng.range(-15, 15),
    colorPattern: ['solid', 'spotted', 'veined', 'gradient'][rng.int(0, 3)] as PatternType,
    
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
