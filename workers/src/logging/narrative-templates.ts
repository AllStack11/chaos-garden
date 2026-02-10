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

const AMBIENT_RAIN_TEMPLATES: readonly string[] = [
  'Rain patters gently on {plantCount} upturned leaves, filling the soil with life.',
  'Droplets cascade through the canopy. The herbivores huddle under broad fronds.',
  'A steady rain washes the garden. Moisture climbs to {moisturePercent}%.',
  'The rain falls and the fungi rejoice. {fungusCount} decomposers spread their mycelium.',
  'Rainfall dulls the light to {sunlightPercent}%. The plants slow their photosynthesis.',
  'Rain drums on the garden. {herbivoreCount} herbivores trudge through the wet, movement slowed.',
  'The air smells of wet earth and possibility. The garden drinks deeply.',
  'Water pools between the roots. The ecosystem adjusts to the slower rhythm of rain.',
];

const AMBIENT_STORM_TEMPLATES: readonly string[] = [
  'Thunder rumbles across the garden. {totalLiving} creatures brace against the gale.',
  'Lightning splits the sky. For an instant, every leaf and claw is illuminated.',
  'The storm rages. Movement grinds to a crawl as creatures seek shelter.',
  'Wind howls through the canopy. Sunlight drops to {sunlightPercent}%. The plants starve.',
  'A violent storm batters the garden. Only the fungi seem unbothered.',
  'The storm pounds relentlessly. {herbivoreCount} herbivores scatter, burning precious energy.',
  'Lightning flashes. The temperature plunges to {temperature}°C. Survival is the only priority.',
  'The full fury of the storm descends. The garden will remember this.',
];

const AMBIENT_FOG_TEMPLATES: readonly string[] = [
  'A thick fog rolls in, muffling the garden in silence. Visibility drops to near zero.',
  'The world shrinks to a few pixels in every direction. The fungi thrive in the dampness.',
  'Fog blankets the garden at {temperature}°C. Creatures move cautiously through the murk.',
  'Dense fog obscures the canopy. The herbivores graze blindly, guided by instinct alone.',
  'The garden disappears into white. {totalLiving} entities navigate by scent and memory.',
  'Fog clings to everything. Sunlight barely reaches {sunlightPercent}%.',
  'In the fog, predator and prey move as ghosts. The garden holds its breath.',
  'A quiet fog settles. The moisture rises to {moisturePercent}%. The mycelium network hums.',
];

const AMBIENT_DROUGHT_TEMPLATES: readonly string[] = [
  'The sun beats mercilessly. Moisture drops to {moisturePercent}%. Plants wilt visibly.',
  'Cracked earth and withered stems. The garden gasps for water.',
  'Drought tightens its grip at {temperature}°C. {plantCount} plants struggle to photosynthesize.',
  'The air shimmers with heat. Every creature feels the drought in its energy reserves.',
  '{totalLiving} entities endure the drought. The strong survive. The weak become compost.',
  'No rain in sight. Moisture at {moisturePercent}%. The fungi slow to a crawl.',
  'The drought is relentless. Herbivores range farther, burning more energy for less food.',
  'Heat and dryness press down on the garden. Only the most efficient will last.',
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

const AMBIENT_PHILOSOPHY_TEMPLATES: readonly string[] = [
  'The carnivores do not know they are keeping the herbivore population in check. They just think they are hungry.',
  'Every plant that dies feeds a fungus that feeds the soil that feeds the next plant. Nothing is wasted here.',
  'In the garden, there is no good or evil. Only energy, moving from one form to another.',
  'The herbivores eat the plants. The carnivores eat the herbivores. The fungi eat everyone. Democracy.',
  'Each entity lives its entire life in this 800x600 pixel rectangle. To them, it is infinite.',
  'The garden does not care who survives. It only cares that something does.',
  'Somewhere between the photosynthesis and the predation, something like meaning emerges.',
  'Every creature in this garden is optimizing for survival. None of them know the word.',
  '{totalLiving} entities, each running the same basic algorithm: eat, reproduce, do not die. The results are endlessly different.',
  'The plants cannot run. The herbivores cannot photosynthesize. The carnivores cannot eat plants. Specialization is a prison and a gift.',
];

const AMBIENT_INTERSPECIES_TEMPLATES: readonly string[] = [
  '{herbivoreCount} herbivores circle {plantCount} plants. The math is not in the plants\' favor.',
  'The carnivores outnumber the herbivores {carnivoreCount} to {herbivoreCount}. Someone is going to go hungry.',
  '{plantCount} plants versus {herbivoreCount} mouths. The buffet is getting crowded.',
  'The fungi watch the drama between predators and prey with the patience of those who will eat the winner.',
  '{fungusCount} fungi wait for the inevitable. In the end, everything comes to them.',
  'The herbivores avoid the carnivores. The carnivores chase the herbivores. The plants just sit there, judging everyone.',
  'Somewhere, a carnivore passes within pixels of a herbivore. Neither notices. Survival is mostly luck.',
  '{carnivoreCount} predators stalk {herbivoreCount} grazers across {plantCount} patches of green. The ratios tell a story.',
  'The plants grow. The herbivores eat. The carnivores hunt. The fungi decompose. Everybody has a job.',
  'A herbivore grazes near a carnivore\'s path. It does not know how close it came. Ignorance is survival.',
];

const AMBIENT_TENSION_TEMPLATES: readonly string[] = [
  'The {moistureAdjective} conditions at {moisturePercent}% moisture are testing the garden\'s resilience.',
  'Energy reserves are running low across the board. The next few ticks will be decisive.',
  'The ecosystem feels taut, like a string about to snap. {totalLiving} entities hold their collective breath.',
  'Resources grow scarce. The garden is about to find out who is truly fit for survival.',
  'The balance between producers and consumers grows razor-thin. Something will give.',
  'At {temperature}°C and {moisturePercent}% moisture, the garden pushes toward its limits.',
  'The food chain stretches. {herbivoreCount} herbivores compete for {plantCount} plants. Tensions rise.',
  'The garden holds steady, but barely. One bad tick could cascade into something worse.',
  '{totalLiving} entities in a garden that feels smaller every tick. Competition intensifies.',
  'The quiet before the storm. Or maybe just quiet. The garden is not telling.',
];

const AMBIENT_MILESTONE_TEMPLATES: readonly string[] = [
  '{totalLiving} living entities. The garden has never felt so alive. Or so crowded.',
  'The population holds at {totalLiving}. Stable, for now. The garden does not promise stability.',
  '{plantCount} plants form the foundation. Everything else is built on photosynthesis.',
  'The ecosystem supports {totalLiving} lives. Not bad for a pile of algorithms and sunlight.',
  '{herbivoreCount} herbivores and {carnivoreCount} carnivores coexist. Coexist is a generous word.',
  '{fungusCount} fungi quietly maintain the garden\'s recycling program. Unpaid, unappreciated, essential.',
  'At {totalLiving} entities, the garden is a city in miniature. Complete with politics and resource wars.',
  'The garden census reads {totalLiving}. Each one a story. Most of them short.',
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

type NarrativeCategory = 'time' | 'weather' | 'weather_state' | 'population' | 'spotlight' | 'humor' | 'philosophy' | 'interspecies' | 'tension' | 'milestone';

const NARRATIVE_CATEGORY_WEIGHTS: Record<NarrativeCategory, number> = {
  time: 1,
  weather: 1,
  weather_state: 0,
  population: 1,
  spotlight: 1,
  humor: 1,
  philosophy: 1,
  interspecies: 1,
  tension: 0,
  milestone: 1,
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

  // Boost weather-state templates when a notable weather pattern is active
  const activeWeather = environment.weatherState?.currentState;
  if (activeWeather && activeWeather !== 'CLEAR' && activeWeather !== 'OVERCAST') {
    weights.weather_state = 4;
  } else if (activeWeather === 'OVERCAST') {
    weights.weather_state = 1;
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

  // Boost interspecies when predator-prey ratios are dramatic
  if (populations.herbivores > 0 && populations.carnivores > 0) {
    const predatorPreyRatio = populations.carnivores / populations.herbivores;
    if (predatorPreyRatio > 0.8 || predatorPreyRatio < 0.1) {
      weights.interspecies = 3;
    }
  }

  // Boost tension when resources are scarce or environment is harsh
  if (populations.totalLiving <= 20 || environment.moisture <= 0.15 || environment.temperature >= 38) {
    weights.tension = 3;
  } else if (populations.plants > 0 && populations.herbivores / populations.plants > 1.5) {
    weights.tension = 2;
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
function getWeatherStateTemplates(environment: Environment): readonly string[] {
  const weatherState = environment.weatherState?.currentState;
  switch (weatherState) {
    case 'RAIN': return AMBIENT_RAIN_TEMPLATES;
    case 'STORM': return AMBIENT_STORM_TEMPLATES;
    case 'FOG': return AMBIENT_FOG_TEMPLATES;
    case 'DROUGHT': return AMBIENT_DROUGHT_TEMPLATES;
    default: return AMBIENT_WEATHER_TEMPLATES;
  }
}

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
    case 'weather_state':
      templates = getWeatherStateTemplates(environment);
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
    case 'philosophy':
      templates = AMBIENT_PHILOSOPHY_TEMPLATES;
      tags.push('philosophy');
      break;
    case 'interspecies':
      templates = AMBIENT_INTERSPECIES_TEMPLATES;
      tags.push('interspecies');
      break;
    case 'tension':
      templates = AMBIENT_TENSION_TEMPLATES;
      tags.push('tension');
      break;
    case 'milestone':
      templates = AMBIENT_MILESTONE_TEMPLATES;
      tags.push('milestone');
      break;
  }

  const template = pickRandomElement([...templates]) ?? 'The garden exists.';
  const description = fillNarrativeTemplatePlaceholders(template, placeholderValues);

  return { description, tags };
}
