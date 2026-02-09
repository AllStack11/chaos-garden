/**
 * Fungus Visual System
 *
 * Generates unique, persistent visual properties for each fungus entity
 * based on species cues and traits, ensuring deterministic visual variety.
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
    metabolismEfficiency: number;
    decompositionRate: number;
    perceptionRadius: number;
  };
}

interface FungusTraits {
  reproductionRate: number;
  metabolismEfficiency: number;
  decompositionRate: number;
  perceptionRadius: number;
}

export type FungusType = 'toadstool' | 'shelf' | 'puffball' | 'cluster';
export type CapShape = 'round' | 'flat' | 'conical' | 'lobed';

export interface FungusVisual {
  fungusType: FungusType;
  visualSeed: number;

  capScale: number;
  stemScale: number;
  capShape: CapShape;
  capLayers: number;

  baseHueOffset: number;
  saturationOffset: number;
  lightnessOffset: number;

  hasSpots: boolean;
  spotDensity: number;
  hasGills: boolean;
  hasRing: boolean;

  clusterCount: number;
  clusterSpread: number;

  droopFactor: number;
  decayFactor: number;

  glowIntensity: number;
  sporeIntensity: number;
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

function determineFungusType(name: string, species: string): FungusType {
  const normalizedName = name.toLowerCase();
  const normalizedSpecies = species.toLowerCase();
  const prefix = normalizedName.includes('-') ? normalizedName.split('-')[0] : normalizedName;

  // Name-prefix alignment with backend fungus name generation:
  // Spore, Cap, Mycel, Mold, Glow, Damp, Shroom, Puff, Web, Rot
  if (prefix === 'spore' || prefix === 'puff') {
    return 'puffball';
  }

  if (prefix === 'cap' || prefix === 'shroom') {
    return 'toadstool';
  }

  if (prefix === 'mycel' || prefix === 'web' || prefix === 'glow') {
    return 'cluster';
  }

  if (prefix === 'mold' || prefix === 'damp' || prefix === 'rot') {
    return 'shelf';
  }

  // Species fallback and support for legacy/custom names
  if (
    normalizedSpecies.includes('mycel') ||
    normalizedName.includes('cluster') ||
    normalizedName.includes('drift') ||
    normalizedName.includes('creep')
  ) {
    return 'cluster';
  }

  if (normalizedName.includes('puff') || normalizedName.includes('spore') || normalizedName.includes('cloud')) {
    return 'puffball';
  }

  if (
    normalizedName.includes('mushroom') ||
    normalizedName.includes('cap') ||
    normalizedName.includes('toad') ||
    normalizedName.includes('stool')
  ) {
    return 'toadstool';
  }

  if (
    normalizedName.includes('shelf') ||
    normalizedName.includes('bracket') ||
    normalizedName.includes('fan') ||
    normalizedName.includes('wood')
  ) {
    return 'shelf';
  }

  return 'cluster';
}

export function generateFungusVisual(entity: Entity): FungusVisual {
  const seed = generateVisualSeed(entity);
  const random = new SeededRandom(seed);
  const traits = entity.traits as FungusTraits;
  const fungusType = determineFungusType(entity.name, entity.species);

  const typeConfigs: Record<FungusType, {
    capScale: [number, number];
    stemScale: [number, number];
    capShape: CapShape[];
    capLayers: [number, number];
    clusterCount: [number, number];
    clusterSpread: [number, number];
    spotsChance: number;
    gillsChance: number;
    ringChance: number;
    glowMultiplier: number;
    sporeMultiplier: number;
  }> = {
    toadstool: {
      capScale: [0.9, 1.3],
      stemScale: [0.8, 1.2],
      capShape: ['round', 'conical'],
      capLayers: [1, 2],
      clusterCount: [1, 2],
      clusterSpread: [0.2, 0.5],
      spotsChance: 0.75,
      gillsChance: 0.85,
      ringChance: 0.5,
      glowMultiplier: 0.8,
      sporeMultiplier: 0.7,
    },
    shelf: {
      capScale: [0.9, 1.4],
      stemScale: [0.2, 0.5],
      capShape: ['flat', 'lobed'],
      capLayers: [2, 4],
      clusterCount: [2, 5],
      clusterSpread: [0.3, 0.7],
      spotsChance: 0.3,
      gillsChance: 0.2,
      ringChance: 0.05,
      glowMultiplier: 0.9,
      sporeMultiplier: 0.6,
    },
    puffball: {
      capScale: [0.8, 1.2],
      stemScale: [0.1, 0.4],
      capShape: ['round'],
      capLayers: [1, 1],
      clusterCount: [1, 3],
      clusterSpread: [0.2, 0.45],
      spotsChance: 0.2,
      gillsChance: 0.1,
      ringChance: 0.1,
      glowMultiplier: 0.7,
      sporeMultiplier: 1.2,
    },
    cluster: {
      capScale: [0.5, 0.9],
      stemScale: [0.7, 1.1],
      capShape: ['round', 'lobed', 'conical'],
      capLayers: [1, 2],
      clusterCount: [4, 8],
      clusterSpread: [0.45, 1.0],
      spotsChance: 0.45,
      gillsChance: 0.55,
      ringChance: 0.2,
      glowMultiplier: 1.0,
      sporeMultiplier: 0.9,
    },
  };

  const config = typeConfigs[fungusType];
  const healthFactor = entity.health / 100;
  const energyFactor = entity.energy / 100;

  const decompositionInfluence = traits.decompositionRate / 1.5;
  const reproductionInfluence = traits.reproductionRate;
  const perceptionInfluence = Math.min(2, traits.perceptionRadius / 80);

  const hasSpots = random.next() < config.spotsChance;
  const hasGills = random.next() < config.gillsChance;
  const hasRing = random.next() < config.ringChance;

  const glowIntensity = Math.max(
    0,
    (energyFactor * 0.5 + decompositionInfluence * 0.35) * config.glowMultiplier * random.range(0.6, 1.1),
  );

  const sporeIntensity = Math.max(
    0,
    (reproductionInfluence * 0.6 + decompositionInfluence * 0.25 + perceptionInfluence * 0.15) *
      config.sporeMultiplier *
      random.range(0.6, 1.2),
  );

  return {
    fungusType,
    visualSeed: seed,

    capScale: random.range(config.capScale[0], config.capScale[1]) * (0.8 + decompositionInfluence * 0.3),
    stemScale: random.range(config.stemScale[0], config.stemScale[1]) * (0.85 + traits.metabolismEfficiency * 0.2),
    capShape: random.choice(config.capShape),
    capLayers: random.int(config.capLayers[0], config.capLayers[1]),

    baseHueOffset: random.range(-20, 22),
    saturationOffset: random.range(-18, 12),
    lightnessOffset: random.range(-12, 16),

    hasSpots,
    spotDensity: hasSpots ? random.range(0.2, 1.0) : 0,
    hasGills,
    hasRing,

    clusterCount: random.int(config.clusterCount[0], config.clusterCount[1]),
    clusterSpread: random.range(config.clusterSpread[0], config.clusterSpread[1]),

    droopFactor: Math.max(0, 1 - healthFactor),
    decayFactor: Math.min(1, (1 - healthFactor) * 0.8 + random.range(0, 0.2)),

    glowIntensity: Math.min(1.2, glowIntensity),
    sporeIntensity: Math.min(1.4, sporeIntensity),
  };
}

const visualCache = new Map<string, FungusVisual>();

export function getFungusVisual(entity: Entity): FungusVisual {
  if (visualCache.has(entity.id)) {
    return visualCache.get(entity.id)!;
  }

  const visual = generateFungusVisual(entity);
  visualCache.set(entity.id, visual);
  return visual;
}

export function clearFungusVisualCache(): void {
  visualCache.clear();
}
