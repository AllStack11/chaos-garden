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
  'Dawn compiles successfully. {totalLiving} entities boot up with varying levels of confidence.',
  'Breakfast bell rings: {herbivoreCount} herbivores look for salad while {carnivoreCount} carnivores look for herbivores.',
  'The sun clocks in for its shift. No overtime pay. No complaints. Just photons.',
  'Dawn pushes its first commit of the day: light. The plants approve the PR immediately.',
  'Sunrise at {sunlightPercent}% luminosity. The plants are like interns on their first day: absurdly eager.',
  'Morning arrives and {totalLiving} entities begin their daily standups. The fungi do not attend.',
  'The sky boots from dark mode to light mode. The herbivores prefer light mode. The carnivores preferred dark.',
  'Dawn cracks open like an egg over the garden. {plantCount} plants scramble for the yolk (sunlight).',
  'Good morning, garden. {herbivoreCount} herbivores have already opened the fridge. {carnivoreCount} carnivores have already opened the herbivores.',
  'The sun arrives like a senior engineer: late, bright, and immediately changes everything.',
  'Morning check: {plantCount} plants photosynthesizing, {herbivoreCount} herbivores panicking, {carnivoreCount} carnivores stretching. All systems nominal.',
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
  'It is aggressively daytime. Photosynthesis is at full send.',
  'Midday stand-up: plants share growth metrics, herbivores interrupt by chewing the slides.',
  'The sun is absolutely cooking. {plantCount} plants are printing energy like the Fed prints money.',
  'High noon. The {type} population is out here living their best lives (or worst lives, depending on the {type}).',
  'Peak daylight. The plants are thriving. The herbivores are eating. The carnivores are scheming. The fungi are just waiting for everyone to die. Classic.',
  '{sunlightPercent}% sunlight. The plants are making more energy than a blockchain consumes. Impressive.',
  'Midday energy audit: plants are up, herbivores are hustling, carnivores are hunting, fungi are napping. Standard.',
  'The afternoon sun beats down at {temperature}°C. The garden is a productivity machine with no manager and no Slack.',
  'It is so bright that even the fungi briefly consider photosynthesis. They do not pursue it.',
  'The sun hits different at {sunlightPercent}%. Every chloroplast in the garden just got a raise.',
  'Afternoon vibes: {totalLiving} organisms speedrunning survival. No save states.',
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
  'Golden hour hits and every leaf suddenly looks cinematic.',
  'Dusk deploys soft lighting and hard consequences.',
  'The sun logs off. Out-of-office reply: "back in 48 ticks."',
  'Dusk falls. The plants start power-saving mode. The carnivores start power-hunting mode.',
  'Twilight: the hour where herbivores wish they had invested more in perception radius.',
  'The sky dims to {sunlightPercent}%. The plants are clocking out. The fungi are clocking in.',
  'Sunset at {temperature}°C. The garden shifts from "productive workspace" to "horror game lobby."',
  'Dusk settles over {totalLiving} entities. Half are going to sleep. The other half are about to ruin someone\'s sleep.',
  'The sun dips below the horizon like a mic drop. Tomorrow\'s problem: tomorrow.',
  'Golden hour. Even the carnivores look beautiful. Still terrifying, but beautiful.',
  'Evening falls. The ecosystem switches from hard mode to nightmare mode.',
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
  'Night mode enabled. Visibility low, tension high.',
  'At this hour, even the bugs in the code feel nocturnal.',
  'Midnight. The plants are asleep. The herbivores are anxious. The carnivores are thriving. The fungi are decomposing. Nature has no off-hours.',
  'The garden enters dark mode. Not the UI kind. The kind where things eat you.',
  'Night descends. {totalLiving} entities pretend to be brave. The fungi genuinely do not care.',
  '{temperature}°C after dark. The only thing growing is the anxiety of every herbivore.',
  'The stars come out. The plants cannot see them. The herbivores do not care. The fungi are the stars now.',
  'Deep night. The garden runs its nightly batch jobs: decomposition, existential dread, and the occasional murder.',
  'Nighttime in the garden: where every shadow is either a predator, a mushroom, or your imagination.',
  'The moon does not provide photosynthesis. The plants have filed a feature request.',
  '3 AM garden energy: {totalLiving} entities, zero productivity, maximum drama.',
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
  'Rain applies a hydration patch. Soil metrics immediately improve.',
  'The rain is democratic: everyone gets soaked, nobody opts out.',
  'Rain falls on the garden like unsolicited code reviews: wet, persistent, and ultimately good for you.',
  'It is raining. The plants are thriving. The herbivores are soggy. The fungi are having a spa day.',
  'Moisture hits {moisturePercent}%. The soil is hydrated. The fungi are moisturized. Everyone else is miserable.',
  'The rain turns the garden floor into a slip-n-slide. {herbivoreCount} herbivores recalculate their routes.',
  'Rainfall detected. The plants celebrate silently (they always celebrate silently; they are plants).',
  'Rain washes over {totalLiving} entities. Those who photosynthesize: delighted. Those who chase: irritated.',
  'The garden receives a moisture injection of {moisturePercent}%. The fungi rate this weather 10/10.',
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
  'Wind speed: rude. Lightning frequency: concerning.',
  'Emergency weather protocol now active: crouch, cling, and hope.',
  'The storm hits like a production outage at 2 AM: sudden, violent, and nobody is prepared.',
  'Lightning strikes and for one frame, the entire garden is rendered in HDR.',
  'The storm is throwing hands. {totalLiving} entities just want to survive the merge conflict between sky and ground.',
  'Thunder shakes the garden at {temperature}°C. The plants wish they could run. They cannot. They are plants.',
  'Storm damage report: sunlight at {sunlightPercent}%, morale at 0%, fungi at "unbothered."',
  'The wind is not a breeze. The wind is a hostile takeover.',
  'The sky has beef with the garden today. Lightning is the strongly worded email.',
  'Storm warning: all entities are advised to shelter in place. No entities have shelters. Good luck.',
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
  'Fog turns the biome into a stealth game with no minimap.',
  'Visibility reduced, suspense increased.',
  'The fog is so thick you could cut it with a herbivore\'s panic. Which is also thick.',
  'Fog rolls in. {carnivoreCount} predators just got free camouflage. {herbivoreCount} herbivores just got free anxiety.',
  'The garden is buffering. Please wait while the atmosphere loads. Estimated time: unclear.',
  'Visibility: none. Dramatic tension: maximum. Fungi satisfaction: also maximum.',
  'Fog at {moisturePercent}% moisture. Navigation is now faith-based.',
  'The fog is so dense that two entities at ({posX}, {posY}) could bump into each other and still not know who it was.',
  'Dense fog turns the garden into a horror game. The predators love it. The prey do not.',
  'Fog advisory: if you can read this, you are already inside it.',
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
  'The sun is doing too much. Moisture is doing too little.',
  'Drought logic: spend less, waste nothing, survive somehow.',
  'The drought hits different when you are a plant. You cannot even pace nervously. You just stand there and dehydrate.',
  'Moisture at {moisturePercent}%. The soil is drier than the humor in this garden.',
  'Drought status: the garden looks like a website from 2003. Dry, flat, and struggling.',
  '{temperature}°C and falling moisture. The herbivores are stress-eating. The plants are stress-existing.',
  'The drought continues. Water is a myth. Moisture is a legend. Photosynthesis is a prayer.',
  'Drought day {moisturePercent}: the plants have given up on rain and started a GoFundMe.',
  'It is so dry that the fungi are considering a career change. There is nothing to decompose if nothing can grow.',
  'The drought squeezes the garden like a deadline squeezes a developer. Something is going to break.',
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
  'Forecast: {temperature}°C with a high chance of biological overreaction.',
  'Atmospheric middleware reports stable conditions and unstable ambitions.',
  'Weather update: {temperature}°C. The garden responds by doing exactly what it was already doing but slightly different.',
  'The air is {moistureAdjective} and {temperatureAdjective}. If the garden had a thermostat, someone would be fighting over it.',
  '{temperature}°C and {moisturePercent}% moisture. The plants call this "workable." The carnivores call this "irrelevant."',
  'Current conditions: {temperatureAdjective}. The fungi have no temperature preference. They are built different.',
  'Weather check: {temperature}°C. The herbivores do not check the weather. They check for carnivores. Priorities.',
  'The atmosphere is {moistureAdjective} at {moisturePercent}%. The garden takes what it gets and pretends it is fine.',
  'Climate report: {temperature}°C, {moisturePercent}% humidity. Suitable for life. Also suitable for death. It is a versatile temperature.',
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
  '{totalLiving} entities share this biome, and none of them read the terms of service.',
  'Headcount: {plantCount} producers, {herbivoreCount} grazers, {carnivoreCount} hunters, {fungusCount} cleanup specialists.',
  'Garden HR report: {plantCount} remote workers (plants), {herbivoreCount} freelancers (herbivores), {carnivoreCount} executives (carnivores), {fungusCount} janitors (fungi).',
  '{totalLiving} entities coexist. "Coexist" is doing a lot of heavy lifting in that sentence.',
  'The org chart: {plantCount} plants at the bottom, {herbivoreCount} herbivores in the middle, {carnivoreCount} carnivores at the top, and {fungusCount} fungi in the basement running the whole operation.',
  '{totalLiving} living things. Each one thinking it is the main character. Only the fungi are correct.',
  'Census results: {plantCount} green, {herbivoreCount} hungry, {carnivoreCount} dangerous, {fungusCount} patient. Garden total: {totalLiving} and counting (mostly down).',
  'Population snapshot: {totalLiving} entities that all want the same thing (to not die) and all have wildly different strategies for achieving it.',
  'Current active users: {totalLiving}. Daily active users: also {totalLiving}. There is no logging out of this garden.',
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
  '{name} ({type}) has {energy} energy and a suspiciously confident posture.',
  '{name} pauses at ({posX}, {posY}), either buffering or contemplating destiny.',
  '{name} is at ({posX}, {posY}) with {energy} energy. Its daily affirmation: "I am more than my position in the food chain."',
  'Spotlight on {name} the {type}: currently alive, which in this garden is already an achievement.',
  '{name} chills at ({posX}, {posY}). If this were a reality show, {name} would be in the confessional saying "I did not come here to make friends."',
  '{name} exists at ({posX}, {posY}) with the quiet dignity of an entity that does not know it is in a simulation.',
  'Camera pans to {name}. The {type} stares into the middle distance with {energy} energy and zero complaints.',
  '{name} is just vibing at ({posX}, {posY}). No drama. No predators nearby. This is the good timeline.',
  'Fun fact: {name} the {type} has been alive for this long and still does not know what a "tick" is.',
  '{name} at ({posX}, {posY}): living proof that doing the bare minimum can constitute a survival strategy.',
  'The camera finds {name} at ({posX}, {posY}), looking exactly like a {type} that has {energy} energy and opinions about it.',
  'Let us check in on {name}. Status: alive. Energy: {energy}. Location: ({posX}, {posY}). Vibes: immaculate.',
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
  'If this tick had a stack trace, it would just say "everything normal."',
  'No heroics today. Just organisms doing their best not to segfault.',
  'This tick brought to you by: absolutely nothing happening. Tune in next tick for potential carnage.',
  'The most dramatic event this tick was a leaf moving slightly. Gripping television.',
  'Breaking news from the garden: nothing. More nothing at 11.',
  'The garden is quiet. Too quiet. Just kidding, it is the normal amount of quiet.',
  'Today\'s garden forecast: mild chaos with a chance of existential dread.',
  'The ecosystem is in that liminal space between "thriving" and "about to collapse." It is always in that space.',
  'A tick passes. Nothing dies. Nothing is born. The universe checks its watch.',
  'Tick complete. Status: nominal. Drama: zero. Fungi: still plotting.',
  'The garden briefly considers being boring. The thought passes.',
  'Nothing to see here. Just {totalLiving} entities collectively agreeing that this tick was fine.',
  'This tick is the silence between the notes. The music will return. With teeth.',
  'All systems operational. No one was eaten. No one starved. This counts as a holiday in the garden.',
  'Somewhere a developer watches this tick and thinks "maybe I should add more predators."',
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
  'Natural selection is a reviewer that never sleeps and never leaves comments.',
  'Entropy remains undefeated, but life keeps shipping updates.',
  'The garden is an open-source project with no maintainer, no documentation, and somehow it still works.',
  'Every entity in this garden is a temporary arrangement of matter that briefly thinks it matters. It does.',
  'The herbivores do not resent the plants for being immobile. The carnivores do not resent the herbivores for being delicious. There is no resentment in nature. Only lunch.',
  'Life in the garden is a distributed system with no coordinator, eventual consistency, and a very aggressive garbage collector (fungi).',
  'The universe runs the garden as a background process. Priority: low. Uptime: surprisingly high.',
  'Every death feeds a life. Every life delays a death. The garden is a while(true) loop that somehow never crashes.',
  'Consciousness is not required for survival. The plants prove this every single tick. The herbivores disprove it.',
  'In the garden, the fittest survive. "Fittest" is defined by the garden, retroactively, after you are dead.',
  'This garden has no save button. Every tick is permanent. Every choice is final. Even the choices made by things without brains.',
  'If you squint at the garden long enough, you realize it is just a very complicated argument about who gets to eat whom.',
  'The garden teaches one lesson repeatedly: you are either growing or you are being composted. There is no third option.',
  'Every entity here is proof that the universe, given enough time and energy, will produce something that can be eaten by something else.',
  'The meaning of life in the garden: convert energy. The meaning of death: be converted into energy. Elegant, really.',
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
  'The herbivores think the plants are lunch. The carnivores think the herbivores are lunch. Fungi think long-term.',
  '{carnivoreCount} hunters and {herbivoreCount} grazers run a daily experiment in risk management.',
  'The plants produce energy. The herbivores redistribute it. The carnivores redistribute the redistributors. The fungi are the IRS.',
  '{herbivoreCount} herbivores walk past {carnivoreCount} carnivores and somehow survive. Plot armor is real.',
  'The food chain is less of a chain and more of a food Rube Goldberg machine. Sun goes in, compost comes out.',
  '{plantCount} plants stand firm. {herbivoreCount} herbivores approach menacingly. This is the world\'s slowest heist movie.',
  'The herbivores and carnivores are locked in an eternal arms race. The plants are just trying to photosynthesize in peace.',
  'Interspecies relations: plants tolerate herbivores, herbivores fear carnivores, carnivores ignore fungi, fungi outlast everyone. Standard hierarchy.',
  '{carnivoreCount} apex predators, {herbivoreCount} walking calories, {plantCount} solar panels, {fungusCount} cleanup crews. The ratio tells the story.',
  'The garden is a restaurant where the food is also a customer and the customer is also on the menu.',
  'The ecosystem runs on a simple loop: grow, eat, be eaten, decompose, repeat. The comments in the code just say "trust the process."',
  '{fungusCount} fungi observe the predator-prey drama with the patience of a database that knows all records eventually get archived.',
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
  'The ecosystem feels one unlucky roll away from a cascade.',
  'Resource charts are trending toward "uh-oh."',
  'The vibe in the garden just shifted from "sustainable" to "we should have planned for this."',
  'Tension rises. The food chain is a rubber band stretched to its limit. Something will snap. The only question is what.',
  '{totalLiving} entities, shrinking resources, and zero exit strategy. This is the worst escape room ever.',
  'The garden is running low on everything except drama and fungi.',
  'Resource scarcity at {moisturePercent}% moisture. The garden just entered "every entity for itself" mode.',
  'The ecosystem is giving "last 10% of phone battery" energy. Technically alive. Functionally panicking.',
  'Conditions tighten. {herbivoreCount} herbivores compete for {plantCount} plants. The math is getting hostile.',
  'Alert: the garden is now operating in "technical debt" mode. Everything works. Nothing is sustainable.',
  'The tension in this garden is thicker than the fog. And the fog was already pretty thick.',
  '{totalLiving} entities and falling resources. This is what the graphs looked like right before every collapse in history.',
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
  'Milestone reached: {totalLiving} active processes pretending to be destiny.',
  'Population achievement unlocked: "Chaotic, but functioning."',
  '{totalLiving} entities! The garden just hit product-market fit. The product is survival. The market is chaos.',
  'The ecosystem supports {totalLiving} lives. That is {totalLiving} more than most empty JavaScript objects.',
  'Achievement unlocked: {plantCount} plants, {herbivoreCount} herbivores, {carnivoreCount} carnivores, and {fungusCount} fungi all existing at the same time without a segfault.',
  '{totalLiving} inhabitants. The garden is officially more populated than the average developer\'s social life.',
  'The garden census reveals {totalLiving} active entities. Each one a miracle. Each one one bad tick away from being a statistic.',
  '{totalLiving} living entities thriving in 480,000 square pixels. Real estate prices are through the roof.',
  'Population milestone: {totalLiving}. The garden has more residents than bugs in its codebase. Barely.',
  '{fungusCount} fungi maintain the recycling infrastructure for {totalLiving} entities. The real MVPs. No cap.',
  'The garden hits {totalLiving} total lives. This is either an achievement or a warning. Context determines everything.',
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
