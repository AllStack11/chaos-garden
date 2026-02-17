#!/usr/bin/env node
/**
 * Production D1 initializer for Chaos Garden.
 *
 * Seed strategy:
 * - biologically diverse baseline for a 1000-tick horizon
 * - resilient decomposer floor at tick 0
 * - deterministic natural habitat placement with minimum spacing constraints
 * - high diversity in names/species/traits
 *
 * Usage:
 *   node scripts/init-remote-db-prod-v3.js
 *   node scripts/init-remote-db-prod-v3.js --seed=12345
 *   node scripts/init-remote-db-prod-v3.js --verify-only
 *   node scripts/init-remote-db-prod-v3.js --database=chaos-garden-db
 *   node scripts/init-remote-db-prod-v3.js --config=wrangler.jsonc
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_DATABASE_NAME = 'chaos-garden-db';
const DEFAULT_WRANGLER_CONFIG = 'wrangler.jsonc';
const WORKERS_DIR = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.resolve(WORKERS_DIR, 'schema.sql');

const GARDEN_WIDTH = 800;
const GARDEN_HEIGHT = 600;

const SUSTAINABILITY_TICK_WINDOW = 1000;
const SUSTAINABILITY_MINIMUMS = {
  plants: 24,
  herbivores: 8,
  carnivores: 2,
  fungi: 3,
  totalLiving: 45
};

const CANDIDATE_COUNT_BOUNDS = {
  minPlants: 48,
  minHerbivores: 20,
  minCarnivores: 4,
  minFungi: 4,
  maxPlants: 72,
  maxHerbivores: 32,
  maxCarnivores: 8,
  maxFungi: 8
};

const MIN_INITIAL_TOTAL_ENTITIES = 84;
const DEFAULT_COUNT_HEURISTIC_LIMIT = 108;

const TYPE_ORDER = ['plant', 'herbivore', 'carnivore', 'fungus'];

const MIN_SPACING_BY_TYPE = {
  plant: 18,
  herbivore: 26,
  carnivore: 34,
  fungus: 28
};

const NAME_GENERATION_CONFIG = {
  plant: {
    classifierKeywords: ['fern', 'flower', 'grass', 'vine', 'succulent', 'lily', 'moss', 'cactus', 'bush', 'herb', 'briar', 'aloe', 'reed', 'daisy', 'thistle', 'willow'],
    descriptors: ['sun', 'mist', 'river', 'stone', 'verdant', 'wild', 'silver', 'amber', 'meadow', 'dawn', 'brook', 'shade', 'marsh', 'hollow', 'valley', 'bloom'],
    suffixes: ['sprout', 'canopy', 'bloom', 'frond', 'petal', 'branch', 'grove', 'bud', 'thicket', 'stem', 'crown', 'crest', 'leaf', 'root', 'vine', 'spire'],
    speciesFamilies: ['flora', 'canopy', 'grove', 'rootline', 'meadow', 'hedge', 'thicket', 'bloomkin']
  },
  herbivore: {
    classifierKeywords: ['butterfly', 'beetle', 'rabbit', 'snail', 'cricket', 'ladybug', 'grasshopper', 'ant', 'bee', 'moth', 'hare', 'finch', 'mouse', 'wren', 'lark', 'weevil'],
    descriptors: ['swift', 'quiet', 'field', 'wind', 'fleet', 'bright', 'nimble', 'dapple', 'hollow', 'reed', 'coast', 'drift', 'rush', 'light', 'grain', 'trail'],
    suffixes: ['stride', 'dash', 'bound', 'graze', 'hop', 'skitter', 'forage', 'trail', 'flutter', 'rush', 'glide', 'prance', 'drift', 'scurry', 'stride', 'song'],
    speciesFamilies: ['kin', 'folk', 'colony', 'wanderers', 'runners', 'foragers', 'meadowkin', 'trailers']
  },
  carnivore: {
    classifierKeywords: ['wolf', 'fox', 'tiger', 'panther', 'shadow', 'hunt', 'claw', 'fang', 'night', 'stalk', 'viper', 'lynx', 'talon', 'pike', 'storm', 'dire'],
    descriptors: ['grim', 'ashen', 'frost', 'ember', 'void', 'scar', 'iron', 'silent', 'storm', 'thorn', 'onyx', 'shade', 'flint', 'razor', 'gloom', 'night'],
    suffixes: ['strike', 'pounce', 'prowl', 'snare', 'hunter', 'rake', 'lunge', 'ambush', 'howl', 'raid', 'stalker', 'slash', 'snarl', 'maw', 'chase', 'rend'],
    speciesFamilies: ['pack', 'pride', 'stalkers', 'hunters', 'raiders', 'prowlers', 'talons', 'fangline']
  },
  fungus: {
    classifierKeywords: ['spore', 'cap', 'mycel', 'mold', 'glow', 'damp', 'shroom', 'puff', 'web', 'rot', 'gill', 'hypha', 'lichen', 'mire', 'veil', 'frill'],
    descriptors: ['deep', 'wet', 'moss', 'coal', 'murk', 'umbra', 'dusk', 'root', 'quiet', 'bog', 'haze', 'silt', 'peat', 'shade', 'drift', 'loam'],
    suffixes: ['pulse', 'spread', 'bloom', 'rot', 'puff', 'creep', 'glow', 'web', 'drift', 'spore', 'patch', 'ring', 'veil', 'mat', 'cluster', 'frill'],
    speciesFamilies: ['mycelium', 'hyphae', 'sporeline', 'decomposers', 'veilkin', 'rotfolk', 'gillset', 'patchwork']
  }
};

const TRAIT_SAMPLING_KEYS = {
  plant: ['energy', 'reproductionRate', 'metabolismEfficiency', 'photosynthesisRate'],
  herbivore: ['energy', 'reproductionRate', 'movementSpeed', 'metabolismEfficiency', 'perceptionRadius', 'threatDetectionRadius'],
  carnivore: ['energy', 'reproductionRate', 'movementSpeed', 'metabolismEfficiency', 'perceptionRadius'],
  fungus: ['energy', 'reproductionRate', 'metabolismEfficiency', 'decompositionRate', 'perceptionRadius']
};

const TRAIT_RANGES = {
  plant: {
    energy: [56, 76],
    reproductionRate: [0.048, 0.092],
    metabolismEfficiency: [0.94, 1.24],
    photosynthesisRate: [1.02, 1.46]
  },
  herbivore: {
    energy: [62, 84],
    reproductionRate: [0.032, 0.06],
    movementSpeed: [1.9, 3.4],
    metabolismEfficiency: [0.9, 1.3],
    perceptionRadius: [102, 168],
    threatDetectionRadius: [138, 220]
  },
  carnivore: {
    energy: [66, 90],
    reproductionRate: [0.018, 0.034],
    movementSpeed: [3.2, 4.7],
    metabolismEfficiency: [0.95, 1.24],
    perceptionRadius: [150, 230]
  },
  fungus: {
    energy: [48, 68],
    reproductionRate: [0.028, 0.05],
    metabolismEfficiency: [1.04, 1.34],
    decompositionRate: [0.96, 1.4],
    perceptionRadius: [46, 92]
  }
};

const DIVERSITY_MINIMUMS = {
  plant: { minUniqueSpecies: 8 },
  herbivore: { minUniqueSpecies: 6 },
  carnivore: { minUniqueSpecies: 3 },
  fungus: { minUniqueSpecies: 3 }
};

function parseCliArgs(argv) {
  const parsedArgs = {
    verifyOnly: false,
    databaseName: DEFAULT_DATABASE_NAME,
    wranglerConfig: DEFAULT_WRANGLER_CONFIG,
    seed: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--verify-only') {
      parsedArgs.verifyOnly = true;
      continue;
    }

    if (token.startsWith('--seed=')) {
      const seedValue = Number(token.slice('--seed='.length));
      if (!Number.isInteger(seedValue)) {
        throw new Error('Invalid --seed value. Expected integer.');
      }
      parsedArgs.seed = seedValue;
      continue;
    }

    if (token === '--seed') {
      const nextToken = argv[index + 1];
      const seedValue = Number(nextToken);
      if (!nextToken || !Number.isInteger(seedValue)) {
        throw new Error('Invalid --seed value. Expected integer.');
      }
      parsedArgs.seed = seedValue;
      index += 1;
      continue;
    }

    if (token.startsWith('--database=')) {
      const databaseName = token.slice('--database='.length).trim();
      if (!databaseName) {
        throw new Error('Invalid --database value. Expected non-empty database name.');
      }
      parsedArgs.databaseName = databaseName;
      continue;
    }

    if (token === '--database') {
      const nextToken = argv[index + 1];
      if (!nextToken) {
        throw new Error('Invalid --database value. Expected non-empty database name.');
      }
      parsedArgs.databaseName = nextToken.trim();
      index += 1;
      continue;
    }

    if (token.startsWith('--config=')) {
      const configPath = token.slice('--config='.length).trim();
      if (!configPath) {
        throw new Error('Invalid --config value. Expected non-empty config path.');
      }
      parsedArgs.wranglerConfig = configPath;
      continue;
    }

    if (token === '--config') {
      const nextToken = argv[index + 1];
      if (!nextToken) {
        throw new Error('Invalid --config value. Expected non-empty config path.');
      }
      parsedArgs.wranglerConfig = nextToken.trim();
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (parsedArgs.seed === null) {
    parsedArgs.seed = Math.floor(Date.now() % 2147483647);
  }

  return parsedArgs;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, max) {
  return Math.floor(random() * max);
}

function randomFloatInRange(random, min, max) {
  return min + random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffleArrayDeterministically(random, values) {
  const shuffledValues = [...values];
  for (let index = shuffledValues.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, index + 1);
    [shuffledValues[index], shuffledValues[swapIndex]] = [shuffledValues[swapIndex], shuffledValues[index]];
  }
  return shuffledValues;
}

function createShuffledIndexOrder(random, count) {
  const indices = Array.from({ length: count }, (_, index) => index);
  return shuffleArrayDeterministically(random, indices);
}

function createTraitSamplingPlan(random, count, traitKeys) {
  const samplingPlan = {};
  for (const traitKey of traitKeys) {
    samplingPlan[traitKey] = createShuffledIndexOrder(random, count);
  }
  return samplingPlan;
}

function sampleStratifiedValue(random, index, count, min, max) {
  if (count <= 1) {
    return min + ((max - min) * 0.5);
  }

  const bucketSize = (max - min) / count;
  return min + (bucketSize * index) + (random() * bucketSize);
}

function sampleTraitValue(random, traitSamplingPlan, traitKey, entityIndex, min, max) {
  const traitIndices = traitSamplingPlan[traitKey];
  return sampleStratifiedValue(random, traitIndices[entityIndex], traitIndices.length, min, max);
}

function createCycledOrder(random, values, count) {
  const cycledValues = [];
  while (cycledValues.length < count) {
    cycledValues.push(...shuffleArrayDeterministically(random, values));
  }
  return cycledValues.slice(0, count);
}

function createNameSamplingPlan(random, type, count) {
  const config = NAME_GENERATION_CONFIG[type];
  return {
    keywords: createCycledOrder(random, config.classifierKeywords, count),
    descriptors: createCycledOrder(random, config.descriptors, count),
    suffixes: createCycledOrder(random, config.suffixes, count),
    families: createCycledOrder(random, config.speciesFamilies, count)
  };
}

function createDeterministicUuid(random) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = randomInt(random, 16);
    const v = char === 'x' ? n : ((n & 0x3) | 0x8);
    return v.toString(16);
  });
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function toTitleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function determineCandidatePopulationCounts(seed) {
  const random = createSeededRandom(seed ^ 0x1f123bb5);
  const candidateCounts = [];

  for (let plantCount = CANDIDATE_COUNT_BOUNDS.minPlants; plantCount <= CANDIDATE_COUNT_BOUNDS.maxPlants; plantCount += 1) {
    for (let herbivoreCount = CANDIDATE_COUNT_BOUNDS.minHerbivores; herbivoreCount <= CANDIDATE_COUNT_BOUNDS.maxHerbivores; herbivoreCount += 1) {
      for (let carnivoreCount = CANDIDATE_COUNT_BOUNDS.minCarnivores; carnivoreCount <= CANDIDATE_COUNT_BOUNDS.maxCarnivores; carnivoreCount += 1) {
        for (let fungusCount = CANDIDATE_COUNT_BOUNDS.minFungi; fungusCount <= CANDIDATE_COUNT_BOUNDS.maxFungi; fungusCount += 1) {
          candidateCounts.push({
            plantCount,
            herbivoreCount,
            carnivoreCount,
            fungusCount,
            totalLiving: plantCount + herbivoreCount + carnivoreCount + fungusCount
          });
        }
      }
    }
  }

  candidateCounts.sort((left, right) => {
    if (left.totalLiving !== right.totalLiving) {
      return left.totalLiving - right.totalLiving;
    }

    const leftFungusPenalty = left.fungusCount === 1 ? 0 : 1;
    const rightFungusPenalty = right.fungusCount === 1 ? 0 : 1;
    if (leftFungusPenalty !== rightFungusPenalty) {
      return leftFungusPenalty - rightFungusPenalty;
    }

    const leftDistance = Math.abs((left.plantCount / left.herbivoreCount) - 2.7);
    const rightDistance = Math.abs((right.plantCount / right.herbivoreCount) - 2.7);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return random() < 0.5 ? -1 : 1;
  });

  const viableCandidate = candidateCounts.find((candidate) => {
    if (candidate.totalLiving < MIN_INITIAL_TOTAL_ENTITIES) {
      return false;
    }

    if (candidate.totalLiving > DEFAULT_COUNT_HEURISTIC_LIMIT) {
      return false;
    }

    if (candidate.plantCount <= candidate.herbivoreCount) {
      return false;
    }

    if (candidate.herbivoreCount < candidate.carnivoreCount) {
      return false;
    }

    const plantPerHerbivore = candidate.plantCount / candidate.herbivoreCount;
    const herbivorePerCarnivore = candidate.herbivoreCount / candidate.carnivoreCount;

    return plantPerHerbivore >= 2.2 && herbivorePerCarnivore >= 2.5;
  });

  if (viableCandidate) {
    return viableCandidate;
  }

  return {
    plantCount: CANDIDATE_COUNT_BOUNDS.minPlants,
    herbivoreCount: CANDIDATE_COUNT_BOUNDS.minHerbivores,
    carnivoreCount: CANDIDATE_COUNT_BOUNDS.minCarnivores,
    fungusCount: CANDIDATE_COUNT_BOUNDS.minFungi,
    totalLiving:
      CANDIDATE_COUNT_BOUNDS.minPlants +
      CANDIDATE_COUNT_BOUNDS.minHerbivores +
      CANDIDATE_COUNT_BOUNDS.minCarnivores +
      CANDIDATE_COUNT_BOUNDS.minFungi
  };
}

function createEntityIdentity(type, index, usedNames, nameSamplingPlan) {
  const keyword = nameSamplingPlan.keywords[index];
  const descriptor = nameSamplingPlan.descriptors[index];
  const suffix = nameSamplingPlan.suffixes[index];
  const family = nameSamplingPlan.families[index];

  const baseName = `${keyword}-${descriptor}-${suffix}`;

  let candidateName = baseName;
  let dedupeCounter = 2;
  while (usedNames.has(candidateName)) {
    candidateName = `${baseName}-${dedupeCounter}`;
    dedupeCounter += 1;
  }

  usedNames.add(candidateName);
  return {
    name: candidateName,
    species: `${toTitleCase(keyword)} ${toTitleCase(family)}`
  };
}

function createHabitatZoneCenters(random, zoneCount, xPadding, yPadding, minDistance) {
  const centers = [];

  for (let zoneIndex = 0; zoneIndex < zoneCount; zoneIndex += 1) {
    let acceptedCenter = null;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidateCenter = {
        x: randomFloatInRange(random, xPadding, GARDEN_WIDTH - xPadding),
        y: randomFloatInRange(random, yPadding, GARDEN_HEIGHT - yPadding)
      };

      const hasConflict = centers.some((existingCenter) => {
        const dx = existingCenter.x - candidateCenter.x;
        const dy = existingCenter.y - candidateCenter.y;
        return Math.hypot(dx, dy) < minDistance;
      });

      if (!hasConflict) {
        acceptedCenter = candidateCenter;
        break;
      }
    }

    if (!acceptedCenter) {
      acceptedCenter = {
        x: randomFloatInRange(random, xPadding, GARDEN_WIDTH - xPadding),
        y: randomFloatInRange(random, yPadding, GARDEN_HEIGHT - yPadding)
      };
    }

    centers.push(acceptedCenter);
  }

  return centers;
}

function createNaturalPlacementMap(random, counts) {
  const plantZoneCount = Math.max(3, Math.min(5, Math.ceil(counts.plantCount / 3)));
  const plantPatchCenters = createHabitatZoneCenters(random, plantZoneCount, 75, 75, 120);

  const herbivoreBandCenters = plantPatchCenters.map((center) => {
    const angle = randomFloatInRange(random, 0, Math.PI * 2);
    const radius = randomFloatInRange(random, 55, 95);
    return {
      x: clamp(center.x + Math.cos(angle) * radius, 24, GARDEN_WIDTH - 24),
      y: clamp(center.y + Math.sin(angle) * radius, 24, GARDEN_HEIGHT - 24)
    };
  });

  const carnivoreBandCenters = herbivoreBandCenters.map((center) => {
    const angle = randomFloatInRange(random, 0, Math.PI * 2);
    const radius = randomFloatInRange(random, 85, 145);
    return {
      x: clamp(center.x + Math.cos(angle) * radius, 24, GARDEN_WIDTH - 24),
      y: clamp(center.y + Math.sin(angle) * radius, 24, GARDEN_HEIGHT - 24)
    };
  });

  const fungusCorridorCenters = herbivoreBandCenters.map((center, index) => {
    const pairedCarnivoreCenter = carnivoreBandCenters[index % carnivoreBandCenters.length];
    const midpointX = (center.x + pairedCarnivoreCenter.x) * 0.5;
    const midpointY = (center.y + pairedCarnivoreCenter.y) * 0.5;
    const offsetAngle = randomFloatInRange(random, 0, Math.PI * 2);
    const offsetRadius = randomFloatInRange(random, 10, 36);

    return {
      x: clamp(midpointX + Math.cos(offsetAngle) * offsetRadius, 24, GARDEN_WIDTH - 24),
      y: clamp(midpointY + Math.sin(offsetAngle) * offsetRadius, 24, GARDEN_HEIGHT - 24)
    };
  });

  return {
    plant: plantPatchCenters,
    herbivore: herbivoreBandCenters,
    carnivore: carnivoreBandCenters,
    fungus: fungusCorridorCenters
  };
}

function isPositionTooCloseToSameType(placedEntities, type, position, minDistance) {
  return placedEntities.some((entity) => {
    if (entity.type !== type) {
      return false;
    }

    const dx = entity.positionX - position.x;
    const dy = entity.positionY - position.y;
    return Math.hypot(dx, dy) < minDistance;
  });
}

function selectPlacementCenter(placementMap, type, index) {
  const centers = placementMap[type];
  return centers[index % centers.length];
}

function samplePositionAroundCenter(random, center, baseRadius) {
  const angle = randomFloatInRange(random, 0, Math.PI * 2);
  const radius = randomFloatInRange(random, 0, baseRadius);

  return {
    x: clamp(center.x + Math.cos(angle) * radius, 0, GARDEN_WIDTH),
    y: clamp(center.y + Math.sin(angle) * radius, 0, GARDEN_HEIGHT)
  };
}

function createNaturalPosition(type, index, random, placementMap, placedEntities) {
  const center = selectPlacementCenter(placementMap, type, index);

  const radiusByType = {
    plant: 58,
    herbivore: 62,
    carnivore: 72,
    fungus: 44
  };

  const minSpacing = MIN_SPACING_BY_TYPE[type];
  const baseRadius = radiusByType[type];

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const candidate = samplePositionAroundCenter(random, center, baseRadius);

    if (!isPositionTooCloseToSameType(placedEntities, type, candidate, minSpacing)) {
      return candidate;
    }
  }

  return {
    x: clamp(center.x + randomFloatInRange(random, -10, 10), 0, GARDEN_WIDTH),
    y: clamp(center.y + randomFloatInRange(random, -10, 10), 0, GARDEN_HEIGHT)
  };
}

function createEntityTraits(type, index, random, traitSamplingPlan) {
  const ranges = TRAIT_RANGES[type];

  const sampledTraits = {};
  for (const traitKey of Object.keys(ranges)) {
    const [min, max] = ranges[traitKey];
    sampledTraits[traitKey] = sampleTraitValue(random, traitSamplingPlan, traitKey, index, min, max);
  }

  return sampledTraits;
}

function applyTraitDiversityShaping(type, index, totalCount, traits) {
  if (type === 'plant') {
    const antiCorrelationShift = ((index % 2 === 0) ? -1 : 1) * 0.018;
    traits.reproductionRate = clamp(traits.reproductionRate + antiCorrelationShift, TRAIT_RANGES.plant.reproductionRate[0], TRAIT_RANGES.plant.reproductionRate[1]);
    traits.photosynthesisRate = clamp(traits.photosynthesisRate - antiCorrelationShift * 1.7, TRAIT_RANGES.plant.photosynthesisRate[0], TRAIT_RANGES.plant.photosynthesisRate[1]);
  }

  if (type === 'herbivore') {
    const gradient = totalCount <= 1 ? 0 : (index / (totalCount - 1));
    traits.movementSpeed = clamp(traits.movementSpeed + ((gradient - 0.5) * 0.26), TRAIT_RANGES.herbivore.movementSpeed[0], TRAIT_RANGES.herbivore.movementSpeed[1]);
    traits.metabolismEfficiency = clamp(traits.metabolismEfficiency - ((gradient - 0.5) * 0.14), TRAIT_RANGES.herbivore.metabolismEfficiency[0], TRAIT_RANGES.herbivore.metabolismEfficiency[1]);
  }

  if (type === 'carnivore') {
    const antiCorrelationShift = ((index % 2 === 0) ? -1 : 1) * 0.09;
    traits.movementSpeed = clamp(traits.movementSpeed + antiCorrelationShift, TRAIT_RANGES.carnivore.movementSpeed[0], TRAIT_RANGES.carnivore.movementSpeed[1]);
    traits.perceptionRadius = clamp(traits.perceptionRadius - (antiCorrelationShift * 14), TRAIT_RANGES.carnivore.perceptionRadius[0], TRAIT_RANGES.carnivore.perceptionRadius[1]);
  }

  if (type === 'fungus') {
    const antiCorrelationShift = ((index % 2 === 0) ? -1 : 1) * 0.07;
    traits.decompositionRate = clamp(traits.decompositionRate + antiCorrelationShift, TRAIT_RANGES.fungus.decompositionRate[0], TRAIT_RANGES.fungus.decompositionRate[1]);
    traits.metabolismEfficiency = clamp(traits.metabolismEfficiency - (antiCorrelationShift * 0.35), TRAIT_RANGES.fungus.metabolismEfficiency[0], TRAIT_RANGES.fungus.metabolismEfficiency[1]);
  }

  return traits;
}

function createEntity(type, index, random, timestamp, usedNames, traitSamplingPlan, nameSamplingPlan, placementMap, placedEntities) {
  const identity = createEntityIdentity(type, index, usedNames, nameSamplingPlan);
  const position = createNaturalPosition(type, index, random, placementMap, placedEntities);
  const traits = createEntityTraits(type, index, random, traitSamplingPlan);

  applyTraitDiversityShaping(type, index, nameSamplingPlan.keywords.length, traits);

  const baseEntity = {
    id: createDeterministicUuid(random),
    type,
    name: identity.name,
    species: identity.species,
    positionX: position.x,
    positionY: position.y,
    energy: traits.energy,
    traits,
    timestamp
  };

  delete baseEntity.traits.energy;

  return baseEntity;
}

function buildTypeEntities(type, count, random, seedTimestamp, usedNamesByType, placementMap, placedEntities) {
  const traitPlan = createTraitSamplingPlan(random, count, TRAIT_SAMPLING_KEYS[type]);
  const namePlan = createNameSamplingPlan(random, type, count);
  const entities = [];

  for (let index = 0; index < count; index += 1) {
    const entity = createEntity(type, index, random, seedTimestamp, usedNamesByType[type], traitPlan, namePlan, placementMap, placedEntities);
    entities.push(entity);
    placedEntities.push(entity);
  }

  return entities;
}

function generateEntities(seed) {
  const random = createSeededRandom(seed);
  const seedTimestamp = new Date().toISOString();
  const counts = determineCandidatePopulationCounts(seed);

  const usedNamesByType = {
    plant: new Set(),
    herbivore: new Set(),
    carnivore: new Set(),
    fungus: new Set()
  };

  const placementMap = createNaturalPlacementMap(random, counts);
  const placedEntities = [];

  const plants = buildTypeEntities('plant', counts.plantCount, random, seedTimestamp, usedNamesByType, placementMap, placedEntities);
  const herbivores = buildTypeEntities('herbivore', counts.herbivoreCount, random, seedTimestamp, usedNamesByType, placementMap, placedEntities);
  const carnivores = buildTypeEntities('carnivore', counts.carnivoreCount, random, seedTimestamp, usedNamesByType, placementMap, placedEntities);
  const fungi = buildTypeEntities('fungus', counts.fungusCount, random, seedTimestamp, usedNamesByType, placementMap, placedEntities);

  return {
    entities: [...plants, ...herbivores, ...carnivores, ...fungi],
    counts,
    seedTimestamp,
    sustainabilityContract: {
      tickWindow: SUSTAINABILITY_TICK_WINDOW,
      minimums: { ...SUSTAINABILITY_MINIMUMS }
    }
  };
}

function calculateMinimumSameTypeDistance(entities, type) {
  const sameType = entities.filter((entity) => entity.type === type);
  if (sameType.length <= 1) {
    return Number.POSITIVE_INFINITY;
  }

  let minimumDistance = Number.POSITIVE_INFINITY;

  for (let leftIndex = 0; leftIndex < sameType.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sameType.length; rightIndex += 1) {
      const left = sameType[leftIndex];
      const right = sameType[rightIndex];
      const distance = Math.hypot(left.positionX - right.positionX, left.positionY - right.positionY);
      minimumDistance = Math.min(minimumDistance, distance);
    }
  }

  return minimumDistance;
}

function getDiversitySummary(entities) {
  const names = entities.map((entity) => entity.name);
  const uniqueNameCount = new Set(names).size;

  const speciesByType = {
    plant: new Set(),
    herbivore: new Set(),
    carnivore: new Set(),
    fungus: new Set()
  };

  for (const entity of entities) {
    speciesByType[entity.type].add(entity.species);
  }

  return {
    totalNames: names.length,
    uniqueNameCount,
    uniqueSpeciesCounts: {
      plant: speciesByType.plant.size,
      herbivore: speciesByType.herbivore.size,
      carnivore: speciesByType.carnivore.size,
      fungus: speciesByType.fungus.size
    }
  };
}

function createSustainabilitySummary(seedData) {
  return {
    tickWindow: SUSTAINABILITY_TICK_WINDOW,
    minimums: { ...SUSTAINABILITY_MINIMUMS },
    seeded: {
      plants: seedData.counts.plantCount,
      herbivores: seedData.counts.herbivoreCount,
      carnivores: seedData.counts.carnivoreCount,
      fungi: seedData.counts.fungusCount,
      totalLiving: seedData.entities.length
    }
  };
}

function runWranglerExecute(extraArgs, description, commandOptions) {
  const commandArgs = [
    'wrangler',
    'd1',
    'execute',
    commandOptions.databaseName,
    '--remote',
    '--config',
    commandOptions.wranglerConfig,
    ...extraArgs
  ];

  const result = spawnSync('npx', commandArgs, {
    cwd: WORKERS_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(`${description} failed.\nCommand: npx ${commandArgs.join(' ')}\n${combinedOutput}`);
  }

  return result.stdout || '';
}

function isRemoteImportAuthenticationError(error) {
  const errorMessage = error instanceof Error ? error.message : String(error || '');
  if (!errorMessage) {
    return false;
  }

  const hasAuthCode = /code:\s*10000/i.test(errorMessage);
  const mentionsAuthFailure = /authentication error/i.test(errorMessage);
  const mentionsImportEndpoint = /\/import\b/i.test(errorMessage);

  if (hasAuthCode && mentionsAuthFailure) {
    return true;
  }

  return hasAuthCode && mentionsImportEndpoint;
}

function parseSqlStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let quoteState = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (inLineComment) {
      currentStatement += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      currentStatement += char;
      if (char === '*' && nextChar === '/') {
        currentStatement += '/';
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (quoteState) {
      currentStatement += char;

      if (char === quoteState) {
        if (quoteState === '\'' && nextChar === '\'') {
          currentStatement += nextChar;
          index += 1;
        } else {
          quoteState = null;
        }
      }
      continue;
    }

    if (char === '-' && nextChar === '-') {
      currentStatement += '--';
      index += 1;
      inLineComment = true;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      currentStatement += '/*';
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quoteState = char;
      currentStatement += char;
      continue;
    }

    if (char === ';') {
      const trimmedStatement = currentStatement.trim();
      if (trimmedStatement.length > 0) {
        statements.push(trimmedStatement);
      }
      currentStatement = '';
      continue;
    }

    currentStatement += char;
  }

  const trailingStatement = currentStatement.trim();
  if (trailingStatement.length > 0) {
    statements.push(trailingStatement);
  }

  return statements;
}

function executeSqlStatementsIndividually(sql, phaseName, commandOptions) {
  const statements = parseSqlStatements(sql);
  if (statements.length === 0) {
    return;
  }

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    const statementLabel = `${phaseName} [${index + 1}/${statements.length}]`;
    runWranglerExecute([`--command=${statement}`], statementLabel, commandOptions);
  }
}

function executeSqlPhase(sql, phaseName, commandOptions) {
  const tempFileName = `.tmp-prod-init-${phaseName.replace(/\s+/g, '-').toLowerCase()}.sql`;
  const tempFilePath = path.resolve(WORKERS_DIR, tempFileName);

  fs.writeFileSync(tempFilePath, sql, 'utf-8');

  try {
    console.log(`🧩 ${phaseName}...`);
    try {
      runWranglerExecute([`--file=${tempFileName}`], phaseName, commandOptions);
    } catch (error) {
      if (!isRemoteImportAuthenticationError(error)) {
        throw error;
      }

      console.warn('⚠️ Remote SQL file import rejected by Cloudflare auth. Retrying as statement-by-statement execution.');
      executeSqlStatementsIndividually(sql, phaseName, commandOptions);
    }
    console.log(`✅ ${phaseName} complete`);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

function executeSqlCommandJson(command, description, commandOptions) {
  const output = runWranglerExecute([`--command=${command}`, '--json'], description, commandOptions);
  const parsedOutput = JSON.parse(output);
  const [firstResult] = Array.isArray(parsedOutput) ? parsedOutput : [];
  const [firstRow] = firstResult?.results || [];
  return firstRow || null;
}

function executeSqlRowsJson(command, description, commandOptions) {
  const output = runWranglerExecute([`--command=${command}`, '--json'], description, commandOptions);
  const parsedOutput = JSON.parse(output);
  const [firstResult] = Array.isArray(parsedOutput) ? parsedOutput : [];
  return firstResult?.results || [];
}

function assertVerification(checkName, isValid, details) {
  if (!isValid) {
    throw new Error(`Verification failed: ${checkName}. ${details}`);
  }
}

function createCleanupSql() {
  return `
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS simulation_events;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS garden_state;
DROP TABLE IF EXISTS simulation_control;
DROP TABLE IF EXISTS system_metadata;
DROP TABLE IF EXISTS application_logs;
DROP INDEX IF EXISTS idx_application_logs_timestamp;
DROP INDEX IF EXISTS idx_application_logs_level;
DROP INDEX IF EXISTS idx_application_logs_component;
DROP INDEX IF EXISTS idx_application_logs_tick;
DROP INDEX IF EXISTS idx_application_logs_entity;
PRAGMA foreign_keys = ON;
`;
}

function createEntityInsertSql(entity) {
  return `
INSERT INTO entities (
  id, garden_state_id, born_at_tick, is_alive, type, name, species, position_x, position_y,
  energy, health, age, traits, lineage, created_at, updated_at
) VALUES (
  '${escapeSqlString(entity.id)}',
  (SELECT id FROM garden_state WHERE tick = 0 LIMIT 1),
  0,
  1,
  '${escapeSqlString(entity.type)}',
  '${escapeSqlString(entity.name)}',
  '${escapeSqlString(entity.species)}',
  ${entity.positionX},
  ${entity.positionY},
  ${entity.energy},
  100,
  0,
  '${escapeSqlString(JSON.stringify(entity.traits))}',
  'origin',
  '${entity.timestamp}',
  '${entity.timestamp}'
);`;
}

function createSeedSql(seedData, seed) {
  const { entities, counts, seedTimestamp } = seedData;
  const totalLiving = entities.length;
  const sustainabilitySummary = createSustainabilitySummary(seedData);

  const insertStatements = entities.map(createEntityInsertSql).join('\n');

  return `
${insertStatements}

UPDATE garden_state
SET
  timestamp = '${seedTimestamp}',
  sunlight = 0.0,
  plants = ${counts.plantCount},
  herbivores = ${counts.herbivoreCount},
  carnivores = ${counts.carnivoreCount},
  fungi = ${counts.fungusCount},
  dead_plants = 0,
  dead_herbivores = 0,
  dead_carnivores = 0,
  dead_fungi = 0,
  all_time_dead_plants = 0,
  all_time_dead_herbivores = 0,
  all_time_dead_carnivores = 0,
  all_time_dead_fungi = 0,
  total_living = ${totalLiving},
  total_dead = 0,
  all_time_dead = 0,
  total = ${totalLiving},
  weather_state = NULL
WHERE tick = 0;

INSERT INTO simulation_events (
  garden_state_id, tick, timestamp, event_type, description,
  entities_affected, tags, severity, metadata
) VALUES
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', 'Production garden initialized with minimal sustainable habitat-zoned entities', '[]', '["genesis","production","sustainable-seed"]', 'LOW', '{"source":"production-init-v2","seed":${seed},"sustainability":${escapeSqlString(JSON.stringify(sustainabilitySummary))}}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', '${counts.plantCount} plants seeded for production start', '[]', '["plant","birth"]', 'LOW', '{"count":${counts.plantCount},"type":"plants"}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', '${counts.herbivoreCount} herbivores seeded for production start', '[]', '["herbivore","birth"]', 'LOW', '{"count":${counts.herbivoreCount},"type":"herbivores"}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', '${counts.carnivoreCount} carnivores and ${counts.fungusCount} fungi seeded for production start', '[]', '["carnivore","fungus","birth"]', 'LOW', '{"carnivoreCount":${counts.carnivoreCount},"fungusCount":${counts.fungusCount},"type":"predators-and-decomposers"}');
`;
}

function runVerification(commandOptions) {
  console.log('🔍 Verifying production database invariants...');

  const population = executeSqlCommandJson(
    'SELECT plants, herbivores, carnivores, fungi, total_living FROM garden_state WHERE tick = 0 LIMIT 1',
    'Verifying tick zero population summary',
    commandOptions
  );

  assertVerification('tick zero row exists', population !== null, 'Expected a tick 0 row in garden_state.');

  const totalLiving = Number(population.total_living || 0);
  const plants = Number(population.plants || 0);
  const herbivores = Number(population.herbivores || 0);
  const carnivores = Number(population.carnivores || 0);
  const fungi = Number(population.fungi || 0);

  assertVerification('minimum plant count', plants >= CANDIDATE_COUNT_BOUNDS.minPlants, `Expected plants >= ${CANDIDATE_COUNT_BOUNDS.minPlants}, got ${plants}.`);
  assertVerification('minimum herbivore count', herbivores >= CANDIDATE_COUNT_BOUNDS.minHerbivores, `Expected herbivores >= ${CANDIDATE_COUNT_BOUNDS.minHerbivores}, got ${herbivores}.`);
  assertVerification('minimum carnivore count', carnivores >= CANDIDATE_COUNT_BOUNDS.minCarnivores, `Expected carnivores >= ${CANDIDATE_COUNT_BOUNDS.minCarnivores}, got ${carnivores}.`);
  assertVerification(
    'fungi range',
    fungi >= CANDIDATE_COUNT_BOUNDS.minFungi && fungi <= CANDIDATE_COUNT_BOUNDS.maxFungi,
    `Expected fungi in [${CANDIDATE_COUNT_BOUNDS.minFungi},${CANDIDATE_COUNT_BOUNDS.maxFungi}], got ${fungi}.`
  );

  const entityRows = executeSqlRowsJson(
    `SELECT type, name, species, position_x, position_y, traits
     FROM entities
     WHERE is_alive = 1
     ORDER BY type, name, id`,
    'Verifying entity diversity and spacing',
    commandOptions
  );

  assertVerification(
    'entity total matches garden_state',
    entityRows.length === totalLiving,
    `Expected ${totalLiving}, got ${entityRows.length}.`
  );

  const typeCounts = {
    plant: 0,
    herbivore: 0,
    carnivore: 0,
    fungus: 0
  };

  const normalizedEntities = entityRows.map((row) => {
    const type = row.type;
    if (Object.prototype.hasOwnProperty.call(typeCounts, type)) {
      typeCounts[type] += 1;
    }

    return {
      type,
      name: row.name,
      species: row.species,
      positionX: Number(row.position_x),
      positionY: Number(row.position_y),
      traits: JSON.parse(row.traits)
    };
  });

  assertVerification('plant count consistency', typeCounts.plant === plants, `Expected ${plants}, got ${typeCounts.plant}.`);
  assertVerification('herbivore count consistency', typeCounts.herbivore === herbivores, `Expected ${herbivores}, got ${typeCounts.herbivore}.`);
  assertVerification('carnivore count consistency', typeCounts.carnivore === carnivores, `Expected ${carnivores}, got ${typeCounts.carnivore}.`);
  assertVerification('fungus count consistency', typeCounts.fungus === fungi, `Expected ${fungi}, got ${typeCounts.fungus}.`);

  const diversitySummary = getDiversitySummary(normalizedEntities);
  assertVerification('global unique names', diversitySummary.uniqueNameCount === diversitySummary.totalNames, `Expected ${diversitySummary.totalNames} unique names, got ${diversitySummary.uniqueNameCount}.`);

  for (const type of TYPE_ORDER) {
    const minimumSpecies = DIVERSITY_MINIMUMS[type].minUniqueSpecies;
    assertVerification(
      `${type} unique species minimum`,
      diversitySummary.uniqueSpeciesCounts[type] >= Math.min(minimumSpecies, typeCounts[type]),
      `Expected at least ${Math.min(minimumSpecies, typeCounts[type])}, got ${diversitySummary.uniqueSpeciesCounts[type]}.`
    );

    const minimumDistance = calculateMinimumSameTypeDistance(normalizedEntities, type);
    if (Number.isFinite(minimumDistance)) {
      assertVerification(
        `${type} spacing floor`,
        minimumDistance >= Math.max(8, MIN_SPACING_BY_TYPE[type] * 0.45),
        `Expected minimum distance >= ${Math.max(8, MIN_SPACING_BY_TYPE[type] * 0.45).toFixed(2)}, got ${minimumDistance.toFixed(2)}.`
      );
    }
  }

  console.log(`✅ Verification passed (sustainability horizon: ${SUSTAINABILITY_TICK_WINDOW} ticks; plants/herbivores/carnivores/fungi: ${plants}/${herbivores}/${carnivores}/${fungi})`);
}

function initializeProductionDatabase(options) {
  const commandOptions = {
    databaseName: options.databaseName,
    wranglerConfig: options.wranglerConfig
  };

  console.log('🌿 Chaos Garden Production Database Initialization');
  console.log('===================================================');
  console.log(`Mode: ${options.verifyOnly ? 'verify-only' : 'full reset + minimal-sustainable habitat-zoned population'}`);
  console.log(`Database: ${commandOptions.databaseName}`);
  console.log(`Wrangler config: ${commandOptions.wranglerConfig}`);
  console.log(`Seed: ${options.seed}`);

  if (options.verifyOnly) {
    runVerification(commandOptions);
    return;
  }

  const seedData = generateEntities(options.seed);
  console.log(
    `Generated counts => plants: ${seedData.counts.plantCount}, herbivores: ${seedData.counts.herbivoreCount}, carnivores: ${seedData.counts.carnivoreCount}, fungi: ${seedData.counts.fungusCount}`
  );

  executeSqlPhase(createCleanupSql(), 'Dropping existing schema artifacts', commandOptions);
  executeSqlPhase(fs.readFileSync(SCHEMA_PATH, 'utf-8'), 'Applying schema.sql', commandOptions);
  executeSqlPhase(createSeedSql(seedData, options.seed), 'Applying production seed data', commandOptions);

  runVerification(commandOptions);
  console.log('🎉 Production D1 initialization completed successfully');
}

if (require.main === module) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    initializeProductionDatabase(options);
  } catch (error) {
    console.error('❌ Production D1 initialization failed');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  parseCliArgs,
  parseSqlStatements,
  isRemoteImportAuthenticationError,
  determineCandidatePopulationCounts,
  generateEntities,
  calculateMinimumSameTypeDistance,
  getDiversitySummary,
  createSeedSql,
  initializeProductionDatabase,
  SUSTAINABILITY_TICK_WINDOW,
  SUSTAINABILITY_MINIMUMS,
  MIN_SPACING_BY_TYPE
};
