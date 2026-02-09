import type {
  VisualGenome,
  PlantGenome,
  HerbivoreGenome,
  CarnivoreGenome,
  FungusGenome,
  EntityTypeVisual,
} from './types.ts';

interface GenomeSeedInput {
  id: string;
  species: string;
  type: EntityTypeVisual;
  traits: Record<string, number>;
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

const genomeCache = new Map<string, VisualGenome>();

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeTraits(traits: Record<string, number>): string {
  return Object.keys(traits)
    .sort()
    .map((key) => `${key}:${traits[key].toFixed(4)}`)
    .join('|');
}

function createPlantGenome(random: SeededRandom): PlantGenome {
  return {
    branchDepth: Math.floor(random.range(2, 6)),
    phyllotaxisAngle: random.range(118, 154),
    petalDeformation: random.range(0.1, 1),
    veinDensity: random.range(0.2, 1),
    silhouetteNoise: random.range(0.05, 0.4),
  };
}

function createHerbivoreGenome(random: SeededRandom): HerbivoreGenome {
  return {
    segmentRatioA: random.range(0.2, 0.6),
    segmentRatioB: random.range(0.2, 0.6),
    gaitProfile: random.range(0.8, 1.35),
    appendageStyle: random.range(0, 1),
    patternMapSeed: Math.floor(random.range(1, 99999)),
  };
}

function createCarnivoreGenome(random: SeededRandom): CarnivoreGenome {
  return {
    stanceProfile: random.range(0.7, 1.3),
    tailDynamics: random.range(0.6, 1.4),
    stripeMaskFrequency: random.range(1, 6),
    spotMaskFrequency: random.range(2, 10),
  };
}

function createFungusGenome(random: SeededRandom): FungusGenome {
  return {
    colonyTopology: random.range(0.1, 1),
    capUndulationProfile: random.range(0.2, 1.2),
    sporeVentCadence: random.range(0.5, 1.8),
  };
}

export function getVisualGenome(input: GenomeSeedInput): VisualGenome {
  const cached = genomeCache.get(input.id);
  if (cached) return cached;

  const compositeSeed = hashString(`${input.id}|${input.species}|${input.type}|${normalizeTraits(input.traits)}`);
  const random = new SeededRandom(compositeSeed);

  const genome: VisualGenome = {
    seed: compositeSeed,
    plant: createPlantGenome(random),
    herbivore: createHerbivoreGenome(random),
    carnivore: createCarnivoreGenome(random),
    fungus: createFungusGenome(random),
  };

  genomeCache.set(input.id, genome);
  return genome;
}

export function clearVisualGenomeCache(): void {
  genomeCache.clear();
}
