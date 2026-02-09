/**
 * Narrative Template Engine
 *
 * Transforms dry simulation data into nature-documentary prose.
 * Uses randomized template strings with placeholder substitution
 * to generate atmospheric, sometimes funny event descriptions.
 *
 * Each category has multiple templates to avoid repetition.
 * Placeholders use {curlyBrace} notation.
 */

import type { Entity, Environment, PopulationSummary } from '@chaos-garden/shared';
import { pickRandomElement } from '../simulation/environment/helpers';
import { getTimeOfDay } from '../simulation/environment/sunlight-calculator';

// ==========================================
// Template Categories
// ==========================================

const AMBIENT_DAWN_TEMPLATES: readonly string[] = [
  'Dawn breaks over the garden. {plantCount} plants stir awake, reaching for the first light.',
  'The sky blushes pink. A new day begins for {totalLiving} souls in the garden.',
  'Morning dew glistens as sunlight creeps across the undergrowth.',
  'The garden yawns into dawn. Somewhere, a herbivore blinks sleepily.',
  'First light arrives at {sunlightPercent}% intensity. The plants lean in.',
  'Dawn. The fungi pretend they were awake the whole time.',
  'Sunrise paints the garden gold. {herbivoreCount} herbivores begin their daily foraging.',
  'A soft dawn at {temperature}°C. The garden exhales overnight stillness.',
  'The horizon glows. {carnivoreCount} predators sharpen their instincts for the hunt ahead.',
  'Morning breaks gently. The ecosystem stretches its legs.',
];

const AMBIENT_DAY_TEMPLATES: readonly string[] = [
  'High noon blazes down. Every leaf turns upward, drinking the {sunlightPercent}% brilliance.',
  'The sun is generous today. {plantCount} plants photosynthesize with quiet determination.',
  'Midday warmth at {temperature}°C. The garden hums with activity.',
  'Peak sunlight bathes the garden. Energy flows through every chloroplast.',
  'The day is bright and busy. {totalLiving} creatures go about their business.',
  'Full daylight. The herbivores graze, the carnivores stalk, and the plants just stand there.',
  'Sunlight pours in at {sunlightPercent}%. It is a good day to be a plant.',
  'The afternoon sun hangs heavy. {fungusCount} fungi wait patiently in the shadows.',
  'Daylight hours. The predator-prey dance continues its ancient choreography.',
  'A bright day unfolds. The garden buzzes with the quiet drama of survival.',
];

const AMBIENT_DUSK_TEMPLATES: readonly string[] = [
  'Dusk settles like a velvet curtain. The creatures slow their restless wandering.',
  'The sun dips low. {plantCount} plants prepare for the long night ahead.',
  'Evening light fades to {sunlightPercent}%. The garden grows contemplative.',
  'Twilight descends. The herbivores search for one last meal before dark.',
  'The day surrenders to dusk. Shadows stretch across the garden floor.',
  'Sunset at {temperature}°C. The fungi sense the moisture rising.',
  'Dusk. The carnivores grow bold as darkness approaches.',
  'Evening falls softly. {totalLiving} inhabitants settle into their routines.',
  'The last rays of light slip away. The garden shifts to night mode.',
  'Twilight hush. Even the most restless creatures pause to watch the sky.',
];

const AMBIENT_NIGHT_TEMPLATES: readonly string[] = [
  'Midnight. The garden breathes softly in the dark, {totalLiving} souls dreaming.',
  'The night is deep and quiet. Only the fungi seem truly at home.',
  'Stars wheel overhead. The plants conserve energy, waiting for dawn.',
  'Darkness blankets the garden. {herbivoreCount} herbivores sleep fitfully, stomachs rumbling.',
  'The nocturnal garden hums with invisible energy and silent decay.',
  'Night falls. The carnivores prowl the dark edges of the garden.',
  'A still night at {temperature}°C. The ecosystem rests, mostly.',
  'Moonless dark. The fungi continue their patient work of decomposition.',
  'The garden sleeps. Well, the plants do. Everyone else is anxious.',
  'Deep night. {fungusCount} fungi spread their mycelium in the darkness, unbothered.',
];

const AMBIENT_WEATHER_TEMPLATES: readonly string[] = [
  'A {temperatureAdjective} {temperature}°C breeze ripples through the canopy.',
  'The air is {moistureAdjective} today, moisture at {moisturePercent}%.',
  'Temperature holds at {temperature}°C. The ecosystem adjusts accordingly.',
  '{moisturePercent}% moisture hangs in the air. The fungi approve.',
  'The weather is {temperatureAdjective} and {moistureAdjective}. Life adapts.',
  'A {temperatureAdjective} day at {temperature}°C with {moisturePercent}% humidity.',
  'The atmosphere feels {moistureAdjective}. Plants rustle in the {temperatureAdjective} air.',
  'Weather report: {temperature}°C, {moisturePercent}% moisture. The garden takes note.',
  'Conditions are {temperatureAdjective}. The creatures adjust their metabolisms.',
  'The garden thermometer reads {temperature}°C. {moisturePercent}% moisture hangs in the air.',
];

const AMBIENT_POPULATION_TEMPLATES: readonly string[] = [
  'The garden hums with {totalLiving} inhabitants, each busy with the business of survival.',
  '{plantCount} plants sway gently, outnumbering the {herbivoreCount} hungry herbivores.',
  'The predator-prey balance holds: {carnivoreCount} hunters stalk {herbivoreCount} grazers.',
  'Census update: {plantCount} flora, {herbivoreCount} grazers, {carnivoreCount} stalkers, {fungusCount} decomposers.',
  'A bustling ecosystem of {totalLiving} creatures shares this small digital world.',
  '{herbivoreCount} herbivores wander among {plantCount} plants. The ratio seems sustainable. For now.',
  'The fungi number {fungusCount}, quietly recycling what the others leave behind.',
  'Population dynamics: plenty of drama, zero complaints filed.',
];

const AMBIENT_ENTITY_SPOTLIGHT_TEMPLATES: readonly string[] = [
  '{name} sits quietly at ({posX}, {posY}), contemplating the meaning of energy.',
  'Somewhere in the garden, {name} goes about its day undisturbed.',
  '{name} has {energy} energy and no particular plans right now.',
  'A creature named {name} exists peacefully at this moment. That is enough.',
  '{name} the {type} rests near ({posX}, {posY}). All is well in its tiny world.',
  'If you could ask {name} how it feels, it would probably say "photosynthesis."',
  '{name} surveys its surroundings from ({posX}, {posY}) with quiet confidence.',
  '{name} is doing absolutely nothing remarkable, and that is perfectly fine.',
];

const AMBIENT_HUMOR_TEMPLATES: readonly string[] = [
  'Nothing dramatic happened this tick. Even ecosystems need a breather.',
  'The fungi are gossiping again. Nobody knows what they are saying.',
  'A butterfly pauses. A plant photosynthesizes. The universe continues.',
  'Tick complete. No extinctions. No explosions. Just vibes.',
  'The garden exists peacefully for one whole tick. Suspicious.',
  'All quiet on the botanical front.',
  'The most exciting thing that happened was cellular respiration.',
  'Another tick, another day in paradise. Or at least, in a simulation.',
  'The ecosystem hums along. No complaints from management.',
  'Nothing to report. The garden is simply gardening.',
];

// ==========================================
// Adjective Helpers
// ==========================================

/**
 * Describe temperature as a human-readable adjective.
 */
function describeTemperatureAsAdjective(temperature: number): string {
  if (temperature >= 35) return 'scorching';
  if (temperature >= 28) return 'warm';
  if (temperature >= 22) return 'pleasant';
  if (temperature >= 15) return 'mild';
  if (temperature >= 10) return 'cool';
  if (temperature >= 5) return 'chilly';
  return 'freezing';
}

/**
 * Describe moisture level as a human-readable adjective.
 */
function describeMoistureAsAdjective(moisture: number): string {
  if (moisture >= 0.8) return 'lush and humid';
  if (moisture >= 0.6) return 'comfortably moist';
  if (moisture >= 0.4) return 'moderately dry';
  if (moisture >= 0.2) return 'dry';
  return 'parched';
}

// ==========================================
// Template Selection Logic
// ==========================================

type NarrativeCategory = 'time' | 'weather' | 'population' | 'spotlight' | 'humor';

const NARRATIVE_CATEGORY_WEIGHTS: Record<NarrativeCategory, number> = {
  time: 1,
  weather: 1,
  population: 1,
  spotlight: 1,
  humor: 1,
};

/**
 * Select the most contextually interesting narrative category.
 * Weights categories based on what is currently happening in the garden.
 */
function selectNarrativeCategoryForContext(
  timeOfDay: 'night' | 'dawn' | 'day' | 'dusk',
  environment: Environment,
  populations: PopulationSummary,
  entities: Entity[]
): NarrativeCategory {
  const weights = { ...NARRATIVE_CATEGORY_WEIGHTS };

  // Boost time-of-day during transitions
  if (timeOfDay === 'dawn' || timeOfDay === 'dusk') {
    weights.time = 3;
  }

  // Boost weather during extreme conditions
  if (environment.temperature >= 35 || environment.temperature <= 5) {
    weights.weather = 3;
  }
  if (environment.moisture >= 0.8 || environment.moisture <= 0.2) {
    weights.weather = Math.max(weights.weather, 2);
  }

  // Boost population when counts are notable
  if (populations.totalLiving <= 15 || populations.totalLiving >= 80) {
    weights.population = 2;
  }

  // Boost spotlight when there are interesting entities
  if (entities.length > 0) {
    weights.spotlight = 1;
  } else {
    weights.spotlight = 0;
  }

  // Build weighted array and pick
  const weightedCategories: NarrativeCategory[] = [];
  for (const [category, weight] of Object.entries(weights) as [NarrativeCategory, number][]) {
    for (let i = 0; i < weight; i++) {
      weightedCategories.push(category);
    }
  }

  return pickRandomElement(weightedCategories) ?? 'humor';
}

/**
 * Get the template array for a time-of-day phase.
 */
function getTimeOfDayTemplates(timeOfDay: 'night' | 'dawn' | 'day' | 'dusk'): readonly string[] {
  switch (timeOfDay) {
    case 'dawn': return AMBIENT_DAWN_TEMPLATES;
    case 'day': return AMBIENT_DAY_TEMPLATES;
    case 'dusk': return AMBIENT_DUSK_TEMPLATES;
    case 'night': return AMBIENT_NIGHT_TEMPLATES;
  }
}

// ==========================================
// Placeholder Substitution
// ==========================================

/**
 * Replace {placeholder} tokens in a template string with actual values.
 */
function fillNarrativeTemplatePlaceholders(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

// ==========================================
// Public API
// ==========================================

/**
 * Generate an ambient narrative blurb for the current tick.
 * Selects a contextually appropriate template category,
 * picks a random template, and fills in placeholder values.
 */
export function generateAmbientNarrativeForTick(
  environment: Environment,
  populations: PopulationSummary,
  entities: Entity[]
): { description: string; tags: string[] } {
  const timeOfDay = getTimeOfDay(environment.tick);
  const category = selectNarrativeCategoryForContext(timeOfDay, environment, populations, entities);

  // Build common placeholder values
  const placeholderValues: Record<string, string | number> = {
    plantCount: populations.plants,
    herbivoreCount: populations.herbivores,
    carnivoreCount: populations.carnivores,
    fungusCount: populations.fungi,
    totalLiving: populations.totalLiving,
    temperature: Math.round(environment.temperature),
    sunlightPercent: Math.round(environment.sunlight * 100),
    moisturePercent: Math.round(environment.moisture * 100),
    temperatureAdjective: describeTemperatureAsAdjective(environment.temperature),
    moistureAdjective: describeMoistureAsAdjective(environment.moisture),
    timeOfDay,
  };

  let templates: readonly string[];
  const tags: string[] = [timeOfDay];

  switch (category) {
    case 'time':
      templates = getTimeOfDayTemplates(timeOfDay);
      tags.push('atmosphere');
      break;
    case 'weather':
      templates = AMBIENT_WEATHER_TEMPLATES;
      tags.push('weather');
      break;
    case 'population':
      templates = AMBIENT_POPULATION_TEMPLATES;
      tags.push('census');
      break;
    case 'spotlight': {
      templates = AMBIENT_ENTITY_SPOTLIGHT_TEMPLATES;
      tags.push('spotlight');
      // Pick a random entity for spotlight placeholders
      const spotlightEntity = pickRandomElement(entities);
      if (spotlightEntity) {
        placeholderValues.name = spotlightEntity.name;
        placeholderValues.type = spotlightEntity.type;
        placeholderValues.energy = Math.round(spotlightEntity.energy);
        placeholderValues.posX = Math.round(spotlightEntity.position.x);
        placeholderValues.posY = Math.round(spotlightEntity.position.y);
      }
      break;
    }
    case 'humor':
      templates = AMBIENT_HUMOR_TEMPLATES;
      tags.push('humor');
      break;
  }

  const template = pickRandomElement([...templates]) ?? 'The garden exists.';
  const description = fillNarrativeTemplatePlaceholders(template, placeholderValues);

  return { description, tags };
}
