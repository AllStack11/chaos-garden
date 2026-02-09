/**
 * Event Description Templates
 *
 * Transforms mechanical simulation events into nature-documentary prose.
 * Each event type has multiple randomized templates that use entity names,
 * traits, and context to produce descriptions that feel alive.
 *
 * Placeholder notation: {curlyBrace} — substituted at generation time.
 */

import type { Entity, EntityType, PopulationSummary } from '@chaos-garden/shared';
import { pickRandomElement } from '../simulation/environment/helpers';

// ==========================================
// Birth Templates
// ==========================================

const BIRTH_PLANT_TEMPLATES: readonly string[] = [
  '{name} unfurls its first leaves, already reaching for the light.',
  'A tiny sprout named {name} pushes through the soil. The garden grows.',
  '{name} appears at ({posX}, {posY}), looking optimistic about photosynthesis.',
  'The garden welcomes {name}, a fresh little plant with everything to prove.',
  '{name} begins its life as a plant. It has no idea what it is in for.',
  'New growth: {name} emerges near ({posX}, {posY}), unbothered by the chaos around it.',
  '{name} springs into existence. Somewhere, a herbivore perks up.',
  'A green newcomer called {name} takes root. Its future depends entirely on sunlight and luck.',
];

const BIRTH_HERBIVORE_TEMPLATES: readonly string[] = [
  '{name} enters the garden with wide eyes and an empty stomach.',
  'A new herbivore named {name} takes its first tentative steps at ({posX}, {posY}).',
  '{name} is born hungry. This is normal for herbivores.',
  'The garden gains {name}, a herbivore who will soon discover that plants fight back (they do not).',
  '{name} arrives at ({posX}, {posY}) and immediately starts looking for food.',
  'Welcome, {name}. The plants are over there. The carnivores are also over there. Good luck.',
  '{name} blinks into existence. It has {energy} energy and a whole world to explore.',
  'A new grazer called {name} joins the ecosystem. The food chain grows one link longer.',
];

const BIRTH_CARNIVORE_TEMPLATES: readonly string[] = [
  '{name} emerges, already scanning for prey. The herbivores should worry.',
  'A predator named {name} is born at ({posX}, {posY}). The food chain just got taller.',
  '{name} enters the world with sharp instincts and sharper hunger.',
  'The garden darkens slightly as {name} takes its first breath. A new hunter walks.',
  '{name} appears. Somewhere nearby, a herbivore gets a bad feeling.',
  'Born to hunt: {name} arrives at ({posX}, {posY}) with {energy} energy and zero mercy.',
  '{name} joins the carnivore ranks. The ecosystem balance shifts ever so slightly toward chaos.',
  'A new predator called {name} prowls into existence. Nothing personal, herbivores.',
];

const BIRTH_FUNGUS_TEMPLATES: readonly string[] = [
  '{name} sprouts in the shadows, already eyeing nearby remains.',
  'A fungus named {name} appears at ({posX}, {posY}). It will wait. Fungi are patient.',
  '{name} emerges from the darkness, ready to recycle what others leave behind.',
  'New decomposer: {name} takes root. The circle of life needs its janitors.',
  '{name} grows into the garden quietly. Nobody notices. That is how fungi prefer it.',
  'A patch of mycelium called {name} spreads at ({posX}, {posY}). The dead should be nervous.',
  '{name} appears without fanfare. Fungi do not need fanfare. They need corpses.',
  'The garden gains {name}, a humble fungus who will outlast everything else. Probably.',
];

const BIRTH_TEMPLATES_BY_TYPE: Record<EntityType, readonly string[]> = {
  plant: BIRTH_PLANT_TEMPLATES,
  herbivore: BIRTH_HERBIVORE_TEMPLATES,
  carnivore: BIRTH_CARNIVORE_TEMPLATES,
  fungus: BIRTH_FUNGUS_TEMPLATES,
};

const BIRTH_WITH_PARENT_TEMPLATES: readonly string[] = [
  '{name} is born, carrying on the legacy of {parentName}.',
  '{parentName} has offspring: {name} enters the world, inheriting a will to survive.',
  'Like parent, like child. {name} arrives, a chip off {parentName}.',
  '{name} springs from {parentName}. The family grows.',
  'The lineage continues: {parentName} begets {name}.',
];

// ==========================================
// Death Templates — by cause
// ==========================================

const DEATH_STARVATION_TEMPLATES: readonly string[] = [
  '{name} the {type} ran out of energy. The garden does not forgive empty stomachs.',
  '{name} starved. It searched for food but the garden had other plans.',
  'Hunger claims {name}. At {age} ticks old, it simply could not find enough to eat.',
  '{name} fades away, energy spent. A cautionary tale about resource management.',
  'The {type} named {name} collapses from exhaustion. Even in a garden, nothing is free.',
  '{name} withers to nothing. {energy} energy was not enough to hold on.',
  'Starvation takes {name}. The ecosystem shrugs and moves on.',
  '{name} dies hungry at ({posX}, {posY}). The circle of life is not always a kind circle.',
];

const DEATH_OLD_AGE_TEMPLATES: readonly string[] = [
  '{name} passes peacefully after {age} ticks. A full life, by garden standards.',
  'After {age} ticks of existence, {name} finally rests. Well lived, little {type}.',
  '{name} the {type} dies of old age. It saw {age} ticks of sunrises, storms, and chaos.',
  'Time catches up with {name}. At {age} ticks, it earned its rest.',
  '{name} succumbs to the passage of time. {age} ticks is a respectable run.',
  'Old age claims {name}. The garden remembers, briefly, then keeps going.',
  '{name} lived {age} ticks. Not a bad life for a {type}.',
  'The ancient {type} named {name} finally stops. {age} ticks. That is a legacy.',
];

const DEATH_HEALTH_TEMPLATES: readonly string[] = [
  '{name} the {type} deteriorates beyond recovery. Health drops to zero.',
  '{name} wastes away at ({posX}, {posY}). Sometimes the garden is harsh.',
  'The {type} called {name} succumbs to poor health. The conditions were not kind.',
  '{name} withers. At {health} health, there was nothing left to save.',
  '{name} crumbles. The garden reclaims what it gave.',
  'Poor health takes {name}. The ecosystem does not offer second opinions.',
];

const DEATH_PREDATION_HERBIVORE_TEMPLATES: readonly string[] = [
  '{name} becomes someone else\'s lunch. The food chain is unforgiving.',
  'A predator catches {name}. Nature is efficient, if not always pleasant.',
  '{name} was in the wrong place at the wrong time. A carnivore disagreed with its life choices.',
  'The herbivore {name} meets its end as prey. It lived {age} ticks, which is more than some.',
  '{name} is taken by a hunter. The plants nearby are quietly relieved.',
];

const DEATH_UNKNOWN_TEMPLATES: readonly string[] = [
  '{name} the {type} dies under mysterious circumstances. The garden keeps its secrets.',
  '{name} is gone. Nobody knows exactly why. The ecosystem moves on.',
  'The {type} called {name} ceases to exist. Cause: unclear. Effect: one fewer mouth to feed.',
];

// ==========================================
// Reproduction Templates
// ==========================================

const REPRODUCTION_TEMPLATES: readonly string[] = [
  '{parentName} reproduces, and {offspringName} enters the world. Life finds a way.',
  '{parentName} successfully creates {offspringName}. The gene pool widens.',
  'New life: {parentName} gives rise to {offspringName} near ({posX}, {posY}).',
  '{parentName} the {parentType} produces offspring: meet {offspringName}.',
  'The {parentType} population grows by one. {parentName} welcomes {offspringName}.',
  '{offspringName} is born from {parentName}. Another mouth to feed, another story to tell.',
  '{parentName} splits its energy to create {offspringName}. Parenthood: always an investment.',
  'Reproduction successful: {offspringName} inherits {parentName}\'s best (and worst) traits.',
];

// ==========================================
// Mutation Templates — by trait
// ==========================================

const MUTATION_PHOTOSYNTHESIS_TEMPLATES: readonly string[] = [
  '{name} evolves {direction} photosynthesis ({percentChange}%). The sun just got {adjective}.',
  '{name}\'s chloroplasts {verb}. Photosynthesis shifts by {percentChange}%.',
  'Evolution tinkers with {name}\'s solar panels. {percentChange}% {direction} efficient.',
  '{name} mutates: sunlight conversion {direction} by {percentChange}%. Small change, big consequences.',
];

const MUTATION_SPEED_TEMPLATES: readonly string[] = [
  '{name} gets {direction} legs. Movement speed shifts {percentChange}%.',
  '{name} evolves {adjective} movement ({percentChange}%). {commentary}',
  'Natural selection adjusts {name}\'s speed by {percentChange}%. {direction} and {adjective}.',
  '{name}\'s locomotion mutates. {percentChange}% {direction}. The prey (or predators) take note.',
];

const MUTATION_REPRODUCTION_TEMPLATES: readonly string[] = [
  '{name}\'s reproductive drive shifts {percentChange}%. The population models recalculate.',
  'Evolution nudges {name}\'s reproduction rate {direction} by {percentChange}%.',
  '{name} mutates toward {adjective} reproduction ({percentChange}%). The gene pool ripples.',
  'Reproductive mutation in {name}: {percentChange}% {direction}. The next generation will differ.',
];

const MUTATION_METABOLISM_TEMPLATES: readonly string[] = [
  '{name}\'s metabolism evolves: {percentChange}% {direction} efficient. Every calorie counts.',
  'Metabolic mutation in {name}. Energy conversion shifts {percentChange}%.',
  '{name} develops a {adjective} metabolism ({percentChange}% change). Survival odds adjust.',
  'Evolution tweaks {name}\'s energy processing by {percentChange}%. Adapt or perish.',
];

const MUTATION_DECOMPOSITION_TEMPLATES: readonly string[] = [
  '{name}\'s decomposition abilities mutate by {percentChange}%. The dead matter is concerned.',
  'Fungal evolution: {name} breaks down matter {percentChange}% {direction} effectively.',
  '{name} gets {adjective} at recycling ({percentChange}% change). The circle of life applauds.',
  '{name}\'s rot game evolves. {percentChange}% {direction}. Nothing escapes decay.',
];

const MUTATION_PERCEPTION_TEMPLATES: readonly string[] = [
  '{name}\'s perception shifts {percentChange}%. It sees the world a little differently now.',
  'Sensory mutation: {name} can detect things {percentChange}% {direction} effectively.',
  '{name} evolves {adjective} awareness ({percentChange}%). {commentary}',
  'Natural selection adjusts {name}\'s senses by {percentChange}%.',
];

const MUTATION_GENERIC_TEMPLATES: readonly string[] = [
  '{name} shows a {percentChange}% shift in {trait}. Evolution never sleeps.',
  'A quiet mutation: {name}\'s {trait} changes by {percentChange}%. The garden barely notices.',
  '{name} the {type} mutates. {trait} shifts {percentChange}%. Small steps, big journeys.',
  'Genetic drift: {name}\'s {trait} evolves {percentChange}%. Nature experiments endlessly.',
];

// ==========================================
// Extinction Templates
// ==========================================

const EXTINCTION_TEMPLATES: readonly string[] = [
  'The last {species} ({type}) has perished. An entire lineage, gone.',
  'Extinction: {species} ({type}) are no more. The garden grows quieter.',
  'The {species} have vanished from the garden. No more {type}s of that kind.',
  '{species} ({type}) go extinct. The ecosystem will never be quite the same.',
  'And just like that, the {species} are gone. Extinction is always sudden in hindsight.',
  'The {type} species {species} disappear forever. The garden does not mourn, but maybe it should.',
  'Farewell, {species}. The last of the {type}s falls. The niche sits empty, waiting.',
  'Gone: {species}. The food chain loses a link. Everything downstream will feel this.',
];

// ==========================================
// Population Explosion Templates
// ==========================================

const POPULATION_EXPLOSION_TEMPLATES: readonly string[] = [
  '{type} population explodes to {count}! The garden is overrun.',
  '{count} {type}s now roam the garden. That is a lot of {type}s.',
  'Population boom: {type} numbers surge to {count}. Resources will be tested.',
  'The {type} population hits {count}. Other species are getting nervous.',
  '{type} count reaches {count}. The ecosystem groans under the weight.',
  'Somebody told the {type}s to reproduce and they took it personally. {count} and counting.',
  '{count} {type}s! The garden has never seen so many. Something will give.',
  'The {type}s are thriving. {count} strong. The balance of power shifts.',
];

// ==========================================
// Ecosystem Collapse Templates
// ==========================================

const ECOSYSTEM_COLLAPSE_TEMPLATES: readonly string[] = [
  'Ecosystem collapse. Only {remaining} entities cling to life. The garden darkens.',
  'The garden is dying. {remaining} souls remain. Recovery will be difficult.',
  'Collapse: {remaining} entities left. The once-thriving ecosystem is a shadow of itself.',
  'Down to {remaining}. The garden teeters on the edge of oblivion.',
  'Critical: only {remaining} living entities. The ecosystem gasps.',
  '{remaining} survivors in a garden that once teemed with life. This is what collapse looks like.',
];

// ==========================================
// Population Delta Templates
// ==========================================

const POPULATION_DELTA_PLANT_GAIN_TEMPLATES: readonly string[] = [
  'Plants flourish: {delta} new plants this tick. The green carpet spreads.',
  'A bloom of {delta} new plants. The herbivores rub their mandibles together.',
  'Plant population surges by {delta}. Photosynthesis is having a good day.',
  '+{delta} plants. The garden floor turns greener. The grazers approve.',
];

const POPULATION_DELTA_PLANT_LOSS_TEMPLATES: readonly string[] = [
  '{absDelta} plants lost this tick. The green is fading.',
  'The plant population drops by {absDelta}. Something is eating faster than it grows.',
  '-{absDelta} plants. The herbivores may have overdone it.',
  'Plants decline by {absDelta}. The food chain trembles from the bottom up.',
];

const POPULATION_DELTA_HERBIVORE_GAIN_TEMPLATES: readonly string[] = [
  'Herbivore numbers climb by {delta}. More mouths, more problems.',
  '+{delta} herbivores. The plants just got more popular (involuntarily).',
  'The grazer population swells by {delta}. The carnivores sharpen their focus.',
  '{delta} new herbivores join the fray. The ecosystem adjusts.',
];

const POPULATION_DELTA_HERBIVORE_LOSS_TEMPLATES: readonly string[] = [
  '{absDelta} herbivores lost. The predators or starvation or both.',
  'Herbivore population drops by {absDelta}. The food chain is ruthless.',
  '-{absDelta} grazers. The plants breathe easier. The carnivores do not.',
  'The herbivore count falls by {absDelta}. Somewhere, a predator goes hungry tonight.',
];

// ==========================================
// Template Selection + Placeholder Filling
// ==========================================

/**
 * Fill {placeholder} tokens in a template with actual values.
 */
function fillTemplatePlaceholders(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

/**
 * Determine direction-related words for a mutation percent change.
 */
function getMutationDirectionWords(percentChange: number): {
  direction: string;
  adjective: string;
  verb: string;
  commentary: string;
} {
  if (percentChange > 0) {
    return {
      direction: 'stronger',
      adjective: 'more useful',
      verb: 'improve',
      commentary: 'An upgrade, courtesy of random chance.',
    };
  }
  return {
    direction: 'weaker',
    adjective: 'less efficient',
    verb: 'degrade',
    commentary: 'Not every mutation is an improvement.',
  };
}

/**
 * Get the mutation template array for a specific trait name.
 */
function getMutationTemplatesForTrait(trait: string): readonly string[] {
  switch (trait) {
    case 'photosynthesisRate': return MUTATION_PHOTOSYNTHESIS_TEMPLATES;
    case 'movementSpeed': return MUTATION_SPEED_TEMPLATES;
    case 'reproductionRate': return MUTATION_REPRODUCTION_TEMPLATES;
    case 'metabolismEfficiency': return MUTATION_METABOLISM_TEMPLATES;
    case 'decompositionRate': return MUTATION_DECOMPOSITION_TEMPLATES;
    case 'perceptionRadius': return MUTATION_PERCEPTION_TEMPLATES;
    default: return MUTATION_GENERIC_TEMPLATES;
  }
}

/**
 * Classify a death cause string into a category for template selection.
 */
function classifyDeathCause(cause: string): 'starvation' | 'old_age' | 'health' | 'predation' | 'unknown' {
  if (cause.includes('starved')) return 'starvation';
  if (cause.includes('old age')) return 'old_age';
  if (cause.includes('withered') || cause.includes('wasted')) return 'health';
  if (cause.includes('eaten') || cause.includes('prey') || cause.includes('hunted')) return 'predation';
  return 'unknown';
}

// ==========================================
// Public API — Narrative Description Generators
// ==========================================

/**
 * Generate a narrative birth description for an entity.
 */
export function generateNarrativeBirthDescription(
  entity: Entity,
  parentName?: string
): string {
  const values: Record<string, string | number> = {
    name: entity.name,
    type: entity.type,
    posX: Math.round(entity.position.x),
    posY: Math.round(entity.position.y),
    energy: Math.round(entity.energy),
  };

  // Use parent-aware template some of the time when a parent exists
  if (parentName && Math.random() < 0.4) {
    values.parentName = parentName;
    const template = pickRandomElement([...BIRTH_WITH_PARENT_TEMPLATES]) ?? BIRTH_WITH_PARENT_TEMPLATES[0];
    return fillTemplatePlaceholders(template, values);
  }

  const typeTemplates = BIRTH_TEMPLATES_BY_TYPE[entity.type] ?? BIRTH_PLANT_TEMPLATES;
  const template = pickRandomElement([...typeTemplates]) ?? typeTemplates[0];
  return fillTemplatePlaceholders(template, values);
}

/**
 * Generate a narrative death description for an entity.
 */
export function generateNarrativeDeathDescription(
  entity: Entity,
  cause: string
): string {
  const causeCategory = classifyDeathCause(cause);

  const values: Record<string, string | number> = {
    name: entity.name,
    type: entity.type,
    age: entity.age,
    energy: Math.round(entity.energy),
    health: Math.round(entity.health),
    posX: Math.round(entity.position.x),
    posY: Math.round(entity.position.y),
  };

  let templates: readonly string[];
  switch (causeCategory) {
    case 'starvation': templates = DEATH_STARVATION_TEMPLATES; break;
    case 'old_age': templates = DEATH_OLD_AGE_TEMPLATES; break;
    case 'health': templates = DEATH_HEALTH_TEMPLATES; break;
    case 'predation': templates = DEATH_PREDATION_HERBIVORE_TEMPLATES; break;
    case 'unknown':
    default: templates = DEATH_UNKNOWN_TEMPLATES; break;
  }

  const template = pickRandomElement([...templates]) ?? templates[0];
  return fillTemplatePlaceholders(template, values);
}

/**
 * Generate a narrative reproduction description.
 */
export function generateNarrativeReproductionDescription(
  parent: Entity,
  offspring: Entity
): string {
  const values: Record<string, string | number> = {
    parentName: parent.name,
    parentType: parent.type,
    offspringName: offspring.name,
    posX: Math.round(offspring.position.x),
    posY: Math.round(offspring.position.y),
  };

  const template = pickRandomElement([...REPRODUCTION_TEMPLATES]) ?? REPRODUCTION_TEMPLATES[0];
  return fillTemplatePlaceholders(template, values);
}

/**
 * Generate a narrative mutation description.
 */
export function generateNarrativeMutationDescription(
  entity: Entity,
  trait: string,
  oldValue: number,
  newValue: number
): string {
  const percentChange = ((newValue - oldValue) / oldValue * 100);
  const directionWords = getMutationDirectionWords(percentChange);
  const templates = getMutationTemplatesForTrait(trait);

  const values: Record<string, string | number> = {
    name: entity.name,
    type: entity.type,
    trait,
    percentChange: `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}`,
    direction: directionWords.direction,
    adjective: directionWords.adjective,
    verb: directionWords.verb,
    commentary: directionWords.commentary,
  };

  const template = pickRandomElement([...templates]) ?? templates[0];
  return fillTemplatePlaceholders(template, values);
}

/**
 * Generate a narrative extinction description.
 */
export function generateNarrativeExtinctionDescription(
  species: string,
  type: EntityType
): string {
  const values: Record<string, string | number> = { species, type };
  const template = pickRandomElement([...EXTINCTION_TEMPLATES]) ?? EXTINCTION_TEMPLATES[0];
  return fillTemplatePlaceholders(template, values);
}

/**
 * Generate a narrative population explosion description.
 */
export function generateNarrativePopulationExplosionDescription(
  type: EntityType,
  count: number
): string {
  const values: Record<string, string | number> = { type, count };
  const template = pickRandomElement([...POPULATION_EXPLOSION_TEMPLATES]) ?? POPULATION_EXPLOSION_TEMPLATES[0];
  return fillTemplatePlaceholders(template, values);
}

/**
 * Generate a narrative ecosystem collapse description.
 */
export function generateNarrativeEcosystemCollapseDescription(
  remainingEntities: number
): string {
  const values: Record<string, string | number> = { remaining: remainingEntities };
  const template = pickRandomElement([...ECOSYSTEM_COLLAPSE_TEMPLATES]) ?? ECOSYSTEM_COLLAPSE_TEMPLATES[0];
  return fillTemplatePlaceholders(template, values);
}

/**
 * Generate a narrative population delta description.
 */
export function generateNarrativePopulationDeltaDescription(
  plantDelta: number,
  herbivoreDelta: number
): string {
  // Pick the most dramatic change to narrate
  const absDeltaPlant = Math.abs(plantDelta);
  const absDeltaHerbivore = Math.abs(herbivoreDelta);

  let templates: readonly string[];
  let values: Record<string, string | number>;

  if (absDeltaPlant >= absDeltaHerbivore) {
    templates = plantDelta > 0 ? POPULATION_DELTA_PLANT_GAIN_TEMPLATES : POPULATION_DELTA_PLANT_LOSS_TEMPLATES;
    values = { delta: absDeltaPlant, absDelta: absDeltaPlant };
  } else {
    templates = herbivoreDelta > 0 ? POPULATION_DELTA_HERBIVORE_GAIN_TEMPLATES : POPULATION_DELTA_HERBIVORE_LOSS_TEMPLATES;
    values = { delta: absDeltaHerbivore, absDelta: absDeltaHerbivore };
  }

  const template = pickRandomElement([...templates]) ?? templates[0];
  return fillTemplatePlaceholders(template, values);
}
