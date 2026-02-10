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
  '{name} checks in at ({posX}, {posY}) and immediately starts min-maxing sunlight angles.',
  'Spawn event: {name}. Objective list: photosynthesize, survive, avoid being salad.',
  '{name} germinates with the confidence of a developer who has never seen their code in production.',
  '{name} enters the world at ({posX}, {posY}). Current skills: standing still, converting sunlight. Career ceiling: standing still, converting sunlight.',
  'Hello world! {name} prints its first leaf. The compiler (nature) accepts it with zero warnings.',
  '{name} boots up with {energy} energy. Task manager shows one process: exist.exe.',
  '{name} deploys to coordinates ({posX}, {posY}). No rollback strategy. No exit plan. Pure commitment.',
  'A new plant called {name} appears. It is green. It is here. It is already the best version of itself.',
  '{name} pushes through the soil like a PR that nobody reviewed but somehow got merged anyway.',
  'git init: {name} takes root at ({posX}, {posY}). First commit: "initial chlorophyll."',
  '{name} enters the food chain at the absolute bottom. Motivational posters were not included.',
  'Plant {name} spawns at ({posX}, {posY}) and immediately begins implementing a solar-powered do-nothing architecture.',
  '{name} emerges. Its business model: stand in one spot and hope the sun shows up. Honestly? Relatable.',
  '{name} appears and chooses violence (photosynthesis). The CO2 never stood a chance.',
  'Breaking: Local plant {name} simply built different. By which we mean: built from soil and sunlight.',
  '{name} joins the garden with no legs, no brain, and no fear. True sigma behavior.',
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
  '{name} arrives with {energy} energy and the confidence of someone who has not met a predator yet.',
  'Tutorial prompt for {name}: "WASD to wander, panic automatically included."',
  '{name} materializes with {energy} energy and the survival instincts of someone who Googles "is this mushroom edible" while already chewing.',
  '{name} spawns at ({posX}, {posY}). Life hack: eat the green things. Life threat: the non-green things eat you.',
  'Herbivore {name} has entered the chat. The plants have left the chat. The plants cannot leave. They are plants.',
  '{name} opens its eyes for the first time. The world is beautiful. The world is also full of teeth.',
  'A herbivore called {name} is born at ({posX}, {posY}). Dietary restrictions: plants only. Predator restrictions: none whatsoever.',
  '{name} starts life as an herbivore. Step 1: find food. Step 2: become food. There is no step 3.',
  '{name} arrives. Its two moods: "eating" and "being chased." Sometimes simultaneously.',
  'New herbivore {name} joins at ({posX}, {posY}). Current status: confused but hungry. Permanent status: confused but hungry.',
  '{name} takes its first steps. Somewhere, a carnivore adds it to their Jira backlog.',
  '{name} is born into a world where everything either feeds you or eats you. No NPCs here.',
  '{name} enters the simulation like a packet entering a network with no firewall.',
  '{name} pops into existence with the energy of a rubber duck and the threat awareness of a TODO comment.',
  'Welcome {name}. The buffet is all-you-can-eat. So are you.',
  '{name} just loaded into the most realistic survival game ever made. The graphics are amazing. The respawn timer is infinite.',
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
  '{name} spawns in like a jump scare with a metabolism.',
  '{name} takes one look around and files a prey discovery ticket.',
  '{name} appears at ({posX}, {posY}) and the background music just changed to something ominous.',
  'Carnivore {name} enters with {energy} energy and the personality of a merge conflict: aggressive and unavoidable.',
  '{name} spawns. Skill tree: 100% allocated to "being terrifying." Zero points in "chill."',
  '{name} is born. Its first thought is lunch. Its second thought is also lunch.',
  'A predator called {name} arrives. It did not come here to make friends. It came here to make meals.',
  '{name} joins the ecosystem at ({posX}, {posY}). The herbivores just collectively updated their LinkedIn to "open to relocation."',
  'New carnivore: {name}. It skipped the tutorial and went straight to the boss fight.',
  '{name} enters the garden like a senior dev entering a codebase with no tests: with intent.',
  '{name} appears. Nature just mass-deployed anxiety to every herbivore in a 150px radius.',
  '{name} is born hungry, angry, and suspiciously good at sprinting. The ecosystem sends its regards.',
  'Top of the food chain just got a new applicant: {name}. Resume: teeth. References: fear.',
  '{name} drops into ({posX}, {posY}) like a hotfix nobody asked for but everyone will remember.',
  'Spawn alert: {name} the carnivore. Herbivore survival rate has been updated to "good luck."',
  '{name} joins the server and immediately starts PvP. Consent was not requested.',
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
  '{name} quietly initializes the decomposition subsystem.',
  '{name} arrives and immediately improves the recycling roadmap.',
  '{name} spawns at ({posX}, {posY}) like a garbage collector — and not the JavaScript kind. The real kind.',
  'Fungus {name} appears. It does not eat the living. It waits. It always waits. Sleep well.',
  '{name} emerges from the void with the patience of a cron job and the inevitability of technical debt.',
  'A new fungus called {name} takes root. Its LinkedIn bio: "turning your dead into everyone else\'s dinner since tick 0."',
  '{name} appears quietly. Nobody rolled out the red carpet. Fungi never expect red carpets. They expect corpses.',
  '{name} joins the garden. Role: post-mortem specialist. Not the kind with a report. The kind with enzymes.',
  'New decomposer {name} at ({posX}, {posY}). It has the energy of a night shift worker and the ambition of entropy itself.',
  '{name} initializes. While everyone else plays the game of life, fungi play the long game of death.',
  '{name} manifests like a background process you forgot was running. It will outlast everything.',
  '{name} arrives. Other entities have goals and dreams. {name} has a compost heap and infinite patience.',
  '{name} the fungus: proof that sometimes the real winners are the ones who show up after everyone else is dead.',
  'git blame points to {name} for the decomposition of every corpse in this zip code.',
  '{name} spawns with {energy} energy and the vibes of an "eventually consistent" database. It will get there.',
  '{name} quietly enters the garden, radiating "I will be the last one standing" energy.',
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
  '{parentName} just pushed a new branch: welcome {name}.',
  'Genetic handoff complete. {name} inherits the adventure and the bugs from {parentName}.',
  '{parentName} forks the repo. {name} is the new branch. Merge conflicts are hereditary.',
  '{name} is born. {parentName} looks on with pride, or whatever the equivalent is when you do not have eyes.',
  '{parentName} just mass-produced a sequel: {name}. Critics are cautiously optimistic.',
  '{name} inherits {parentName}\'s source code. No documentation was provided. Good luck.',
  '{parentName} spawns {name} at ({posX}, {posY}). Parenting style: yeet and yonder.',
  'Breaking: {parentName} deploys child process {name}. Memory usage doubles. Worth it? Debatable.',
  '{name} enters the world as {parentName}\'s legacy code. Refactoring was not an option.',
  '{parentName}: "I brought you into this garden and I can... actually no, I cannot take you out. Carry on, {name}."',
  '{parentName} reproduces. {name} arrives with inherited traits and inherited existential dread.',
  '{name} is a chip off the old block. The block being {parentName}, who is already regretting the energy investment.',
  'npm install {name} --save. Dependencies: {parentName}. License: survival-or-die.',
  '{parentName} open-sources its genes. {name} is the first contributor.',
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
  '{name} searched every direction, but calories never arrived.',
  'Energy budget exceeded. {name} could not make the next tick.',
  '{name} tried intermittent fasting. The "intermittent" part did not work out.',
  '{name} the {type} starves at ({posX}, {posY}). If only photosynthesis were contagious.',
  '{name} dies hungry. Somewhere, a motivational poster about persistence bursts into flames.',
  'ERROR: {name}.feed() returned null for the last time. Process terminated.',
  '{name} collapses with {energy} energy. That is not enough energy to do literally anything, including living.',
  '{name} ran out of fuel like a Tesla in a desert. Range anxiety was justified.',
  '{name} starves. Cause of death: the universe forgot to implement a food delivery API.',
  'RIP {name}. Hunger was the real final boss. All {age} ticks were prologue.',
  '{name} dies of starvation at ({posX}, {posY}). The garden sends no condolences. The garden has no HR department.',
  '{name} the {type} experiences the world\'s most permanent diet.',
  '{name}: "I could eat." Narrator: "{name} could not, in fact, eat."',
  'Stack overflow in {name}\'s hunger function. Too many recursive calls to findFood() with no base case.',
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
  '{name} logs out after {age} ticks. Session complete.',
  '{name} retires from survival after a long run of {age} ticks.',
  '{name} peacefully mass-garbage-collects itself after {age} ticks. Memory freed.',
  'After {age} ticks, {name} reaches end-of-life. No patches available. No CVEs filed.',
  '{name} dies of old age. In its final moments it whispers: "I should have photosynthesized harder."',
  '{name} the {type} finishes its speedrun of life in {age} ticks. Respectable. No world record though.',
  '{name} gracefully shuts down after {age} ticks. Exit code 0. No regrets.',
  'After an illustrious career spanning {age} ticks, {name} closes its final pull request.',
  '{name}: born. Lived. Ate stuff (or was stuff). Died at {age} ticks. No complaints filed.',
  '{name} the {type} retires. {age} ticks. In garden years, that is basically Gandalf.',
  '{name} reaches {age} ticks and decides it has seen enough. Understandable.',
  'SIGTERM received by {name} after {age} ticks. The process exits with dignity.',
  '{name} achieves the rarest accomplishment in this garden: dying of something other than violence.',
  '{name} passes away at age {age}. The garden holds a moment of silence lasting exactly 0 ticks.',
  '{name} hits its TTL. {age} ticks well spent, mostly standing around and metabolizing.',
];

const DEATH_HEALTH_TEMPLATES: readonly string[] = [
  '{name} the {type} deteriorates beyond recovery. Health drops to zero.',
  '{name} wastes away at ({posX}, {posY}). Sometimes the garden is harsh.',
  'The {type} called {name} succumbs to poor health. The conditions were not kind.',
  '{name} withers. At {health} health, there was nothing left to save.',
  '{name} crumbles. The garden reclaims what it gave.',
  'Poor health takes {name}. The ecosystem does not offer second opinions.',
  '{name} reaches system-critical condition and cannot recover.',
  '{name} fades at ({posX}, {posY}), another casualty of harsh parameters.',
  '{name} the {type} collapses. Health: 0. Vibes: also 0.',
  '{name} withers like CSS without a framework. Structural integrity was always optional.',
  '{name} deteriorates at ({posX}, {posY}). The autopsy report just says "everything."',
  '{name} dies of poor health. The garden has no hospital, no insurance, and no sympathy.',
  'Health check failed for {name}. Status: 503 Service Permanently Unavailable.',
  '{name} crumbles like a production server with no monitoring. Nobody saw it coming. Everybody should have.',
  '{name} wastes away. The only treatment available was "be in a better garden." Insufficient.',
  '{name} the {type} deteriorates beyond the point of no return. Even ctrl+Z cannot fix this.',
];

const DEATH_PREDATION_HERBIVORE_TEMPLATES: readonly string[] = [
  '{name} becomes someone else\'s lunch. The food chain is unforgiving.',
  'A predator catches {name}. Nature is efficient, if not always pleasant.',
  '{name} was in the wrong place at the wrong time. A carnivore disagreed with its life choices.',
  'The herbivore {name} meets its end as prey. It lived {age} ticks, which is more than some.',
  '{name} is taken by a hunter. The plants nearby are quietly relieved.',
  '{name} loses a high-speed negotiation with teeth.',
  '{name} becomes a transfer of energy with excellent efficiency.',
  '{name} has been unsubscribed from life by a very motivated carnivore.',
  '{name} was walking. Now {name} is a calorie transfer. The food chain is a flat hierarchy.',
  '{name} experiences the world\'s shortest performance review: "you are food now."',
  'A predator catches {name} at ({posX}, {posY}). {name} did not have time to file a complaint.',
  '{name} gets eaten. In the garden, there is no appeal process.',
  '{name} the herbivore achieves its final form: someone else\'s lunch. Evolution is brutal.',
  '{name} is hunted down after {age} ticks. The predator does not even remember its name. Harsh.',
  '{name} zigged when it should have zagged. The carnivore zigged too, but faster.',
  'Herbivore {name} is removed from the board. Cause: aggressive caloric redistribution.',
  '{name} learns the hard way that "perception radius" is just a suggestion when a carnivore is motivated.',
  '{name}: Task failed successfully. The task was "be alive." The success was "feed a carnivore."',
  '{name} gets caught. Last words (probably): "I should have specced into movementSpeed."',
];

const DEATH_UNKNOWN_TEMPLATES: readonly string[] = [
  '{name} the {type} dies under mysterious circumstances. The garden keeps its secrets.',
  '{name} is gone. Nobody knows exactly why. The ecosystem moves on.',
  'The {type} called {name} ceases to exist. Cause: unclear. Effect: one fewer mouth to feed.',
  '{name} disappears from the board. Root cause analysis pending forever.',
  'Event closed: {name} no longer active. Notes: "it is complicated."',
  '{name} dies and nobody can figure out why. The coroner writes "¯\\_(ツ)_/¯" and clocks out.',
  '{name} the {type} perishes under circumstances that would make a detective quit.',
  'FATAL: {name} terminated. Stack trace: [REDACTED]. Root cause: [CLASSIFIED]. Resolution: death.',
  '{name} has died. Cause of death: yes.',
  '{name} ceases to exist at ({posX}, {posY}). The universe shrugs. The fungi rub their hands together.',
  '{name} dies mysteriously. The garden has no forensics team, only fungi.',
  'Unexplained death: {name}. The post-mortem is a blank page. The funeral is a fungus.',
  '{name} was here. Now {name} is not. The logs are unhelpful. The garden is unbothered.',
  '{name} dies for reasons that would require a debugger and a therapist to untangle.',
  '{name} the {type} exits stage left, pursued by absolutely nothing identifiable.',
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
  '{parentName} ships version 2.0: {offspringName}. Backward compatibility not guaranteed.',
  '{offspringName} arrives with inherited defaults and brand-new chaos.',
  '{parentName} hits Ctrl+C, Ctrl+V. {offspringName} is the paste.',
  '{parentName} decides one of itself is not enough. The world now has to deal with {offspringName} too.',
  '{parentName} forks. {offspringName} clones the repo. Merge day will be interesting.',
  '{offspringName} is born from {parentName} near ({posX}, {posY}). Gender reveal party: cancelled (asexual reproduction).',
  'Factory method {parentName}.reproduce() returns {offspringName}. No exceptions thrown.',
  '{parentName} invests half its energy in {offspringName}. Worst ROI or best ROI? Only time will tell.',
  'Congratulations to {parentName} on the spawn of {offspringName}. No baby shower was held. Fungi were not invited anyway.',
  '{parentName} replicates. {offspringName} loads into the garden with inherited instincts and fresh confusion.',
  '{parentName} the {parentType} says "be fruitful and multiply" and then immediately does both.',
  '{offspringName} pops out of {parentName} like a hotfix at 2 AM. Untested but full of potential.',
  '{parentName} creates {offspringName}. This is either a miracle of nature or an off-by-one error in population control.',
  'new {parentType}({parentName}.genes) => {offspringName}. Constructor called successfully.',
  '{parentName} looked at the ecosystem and thought: "this needs more of me." Welcome, {offspringName}.',
  '{offspringName} inherits {parentName}\'s traits. The good news: survival instincts. The bad news: also the anxiety.',
];

// ==========================================
// Mutation Templates — by trait
// ==========================================

const MUTATION_PHOTOSYNTHESIS_TEMPLATES: readonly string[] = [
  '{name} evolves {direction} photosynthesis ({percentChange}%). The sun just got {adjective}.',
  '{name}\'s chloroplasts {verb}. Photosynthesis shifts by {percentChange}%.',
  'Evolution tinkers with {name}\'s solar panels. {percentChange}% {direction} efficient.',
  '{name} mutates: sunlight conversion {direction} by {percentChange}%. Small change, big consequences.',
  '{name} receives a chlorophyll firmware update: {percentChange}%.',
  'Sunlight pipeline for {name} now runs {percentChange}% different.',
  '{name}\'s solar panels get a {percentChange}% tweak. Elon Musk found dead in a ditch.',
  '{name} mutates its photosynthesis by {percentChange}%. The sun files a support ticket.',
  'Patch notes for {name}: "Adjusted sunlight intake by {percentChange}%. No other changes." Narrator: there were other changes.',
  '{name}\'s chloroplasts hold a team retrospective and decide to change by {percentChange}%.',
  'Evolution refactors {name}\'s photosynthesis code. {percentChange}% different. Tests: nonexistent.',
  '{name} rolls a nat 20 on solar absorption. Photosynthesis mutates by {percentChange}%.',
];

const MUTATION_SPEED_TEMPLATES: readonly string[] = [
  '{name} gets {direction} legs. Movement speed shifts {percentChange}%.',
  '{name} evolves {adjective} movement ({percentChange}%). {commentary}',
  'Natural selection adjusts {name}\'s speed by {percentChange}%. {direction} and {adjective}.',
  '{name}\'s locomotion mutates. {percentChange}% {direction}. The prey (or predators) take note.',
  '{name} gets a mobility patch: {percentChange}% change to movement.',
  '{name} now travels at "new panic speed" after a {percentChange}% mutation.',
  '{name} mutates its legs and now runs {percentChange}% different. The speedometer is confused.',
  'Evolution hacks {name}\'s movement.js. Speed changes by {percentChange}%. No code review required.',
  '{name}\'s speed mutates by {percentChange}%. The herbivores/predators recalculate their escape/chase spreadsheets.',
  '{name} gets a {percentChange}% tweak to locomotion. It does not know if it is faster or slower. Neither does anyone else.',
  '{name} unlocks a mobility DLC: {percentChange}% movement change. Servers not responsible for desync.',
  '{name}\'s legs receive an over-the-air update. Movement changes by {percentChange}%. Reboot required (not really).',
];

const MUTATION_REPRODUCTION_TEMPLATES: readonly string[] = [
  '{name}\'s reproductive drive shifts {percentChange}%. The population models recalculate.',
  'Evolution nudges {name}\'s reproduction rate {direction} by {percentChange}%.',
  '{name} mutates toward {adjective} reproduction ({percentChange}%). The gene pool ripples.',
  'Reproductive mutation in {name}: {percentChange}% {direction}. The next generation will differ.',
  '{name} updates its family expansion strategy by {percentChange}%.',
  '{name}\'s lineage scheduler now runs {percentChange}% {direction}.',
  '{name} mutates its reproduction rate by {percentChange}%. The garden braces for impact (or relaxes, hard to say).',
  'Evolution messes with {name}\'s baby-making settings. {percentChange}% adjustment. No consent form was signed.',
  '{name} gets a {percentChange}% tweak to reproduction. Its future children will never know how close they came to not existing.',
  '{name}\'s biological clock gets recalibrated by {percentChange}%. Nature is its own product manager.',
  'CHANGELOG: {name} reproduction rate modified by {percentChange}%. This is not a drill. Or maybe it is.',
  '{name}\'s contribution to the gene pool changes by {percentChange}%. Genetic diversity has opinions.',
];

const MUTATION_METABOLISM_TEMPLATES: readonly string[] = [
  '{name}\'s metabolism evolves: {percentChange}% {direction} efficient. Every calorie counts.',
  'Metabolic mutation in {name}. Energy conversion shifts {percentChange}%.',
  '{name} develops a {adjective} metabolism ({percentChange}% change). Survival odds adjust.',
  'Evolution tweaks {name}\'s energy processing by {percentChange}%. Adapt or perish.',
  '{name} rewrites its calorie math: {percentChange}% adjustment.',
  '{name} now burns fuel with {percentChange}% different efficiency.',
  '{name} gets a {percentChange}% metabolism update. Its cells hold an all-hands about the new calorie budget.',
  'Evolution runs ALTER TABLE on {name}\'s metabolism. {percentChange}% change committed. No rollback.',
  '{name} mutates its energy processing by {percentChange}%. The mitochondria (the powerhouse of the cell) have been notified.',
  '{name}\'s metabolism shifts {percentChange}%. It is now either a Prius or a Hummer. Time will tell.',
  '{name} gets a metabolic hotfix. {percentChange}% change. Deployment notes: "should be fine."',
  '{name}\'s caloric burn rate changes by {percentChange}%. This is the biological equivalent of switching to a different cloud provider.',
];

const MUTATION_DECOMPOSITION_TEMPLATES: readonly string[] = [
  '{name}\'s decomposition abilities mutate by {percentChange}%. The dead matter is concerned.',
  'Fungal evolution: {name} breaks down matter {percentChange}% {direction} effectively.',
  '{name} gets {adjective} at recycling ({percentChange}% change). The circle of life applauds.',
  '{name}\'s rot game evolves. {percentChange}% {direction}. Nothing escapes decay.',
  '{name} pushes a decomposition optimization of {percentChange}%.',
  '{name} upgrades its compost throughput by {percentChange}%.',
  '{name} gets a {percentChange}% buff to rotting things. The dead matter union files a grievance.',
  'Evolution patches {name}\'s decomposition engine by {percentChange}%. Release notes: "corpses beware."',
  '{name}\'s ability to eat dead things changes by {percentChange}%. The afterlife just got more competitive.',
  '{name} mutates its rot game. {percentChange}% change. The compost heap has never been more efficient (or less).',
  '{name}\'s decomposition rate shifts by {percentChange}%. It is now either a recycling champion or a mild disappointment.',
  'Fungal commit message: "refactor({name}): adjust decomposition by {percentChange}%, closes #entropy."',
];

const MUTATION_PERCEPTION_TEMPLATES: readonly string[] = [
  '{name}\'s perception shifts {percentChange}%. It sees the world a little differently now.',
  'Sensory mutation: {name} can detect things {percentChange}% {direction} effectively.',
  '{name} evolves {adjective} awareness ({percentChange}%). {commentary}',
  'Natural selection adjusts {name}\'s senses by {percentChange}%.',
  '{name} recalibrates sensors by {percentChange}%.',
  '{name} receives a perception hotfix: {percentChange}% change in awareness.',
  '{name} can now see {percentChange}% different. Whether this helps or hurts depends on what it sees.',
  'Evolution upgrades {name}\'s awareness like an antivirus update nobody asked for. {percentChange}% change.',
  '{name}\'s perception mutates by {percentChange}%. It either just got glasses or just lost them.',
  '{name} sees the world {percentChange}% differently now. Philosophically unchanged.',
  '{name}\'s threat detection radius changes by {percentChange}%. The fog of war shifts accordingly.',
  '{name}\'s sensory array reconfigures by {percentChange}%. Whether it notices more food or more danger is anyone\'s guess.',
];

const MUTATION_GENERIC_TEMPLATES: readonly string[] = [
  '{name} shows a {percentChange}% shift in {trait}. Evolution never sleeps.',
  'A quiet mutation: {name}\'s {trait} changes by {percentChange}%. The garden barely notices.',
  '{name} the {type} mutates. {trait} shifts {percentChange}%. Small steps, big journeys.',
  'Genetic drift: {name}\'s {trait} evolves {percentChange}%. Nature experiments endlessly.',
  'Patch notes for {name}: {trait} adjusted by {percentChange}%.',
  '{name} rolls evolutionary dice and gets {percentChange}% on {trait}.',
  '{name} the {type} mutates. {trait} shifts by {percentChange}%. Nobody filed a bug report. This IS the feature.',
  'Evolution pushes to {name}\'s main branch without a PR: {trait} changes {percentChange}%. YOLO.',
  '{name}\'s {trait} gets a {percentChange}% tweak. The A/B test has no control group. We are all in production.',
  '{name} receives a balance patch from the universe. {trait}: {percentChange}%. Patch notes were not published.',
  'Random cosmic ray flips a bit in {name}\'s DNA. {trait} changes by {percentChange}%. That is how evolution works, right?',
  'JIRA-EVOLUTION-{name}: {trait} modified by {percentChange}%. Priority: involuntary. Assignee: natural selection.',
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
  'Archive entry updated: {species} ({type}) now exists only in memory.',
  '{species} exits the simulation permanently. No respawn mechanic provided.',
  'The {species} have been deprecated. No migration path available. Just gone.',
  '404: {species} not found. The {type} lineage returns an empty set forever.',
  '{species} ({type}) reach end of support. No more patches. No more {species}. Just vibes and fossils.',
  'git rm -rf {species}. Committed to history. The {type} branch is deleted.',
  'The last {species} dies. The garden pours one out. (Moisture increases by 0%.)',
  '{species} go extinct. The ecosystem performs a retrospective. Lessons learned: none. It will happen again.',
  'RIP {species}. They came, they {type}\'d, they got absolutely bodied by natural selection.',
  'Extinction event: {species}. The niche they occupied is now an open position. No applicants yet.',
  '{species} is no more. If this were a startup, the postmortem would just say "ran out of runway."',
  'Press F to pay respects. {species} ({type}) have left the server permanently.',
  '{species} vanishes from the garden like a feature that got cut in sprint planning. Nobody noticed until it was too late.',
  'The {species} species is now a 410 Gone. Not just missing. Gone-gone.',
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
  'Breaking news: {count} {type}s and rising. Containment was never an option.',
  'Population alarm: {type} density now at "everyone knows someone" levels ({count}).',
  '{count} {type}s. This is not a population. This is a rave.',
  'The {type} population hits {count} and starts trending on GardenTwitter.',
  '{type} count: {count}. At this point they should incorporate.',
  '{count} {type}s in one garden. The load balancer was not designed for this.',
  'WARNING: {type} population ({count}) exceeds recommended capacity. Please contact your local ecosystem administrator.',
  'The {type}s are speedrunning overpopulation. {count} and climbing. Someone turned off the rate limiter.',
  '{count} {type}s! The garden is basically a {type} convention now. Badges were not provided.',
  '{type} population at {count}. This is the biological equivalent of a DDoS attack.',
  'Exponential growth is no longer theoretical. {count} {type}s and the curve is going vertical.',
  '{count} {type}s crowd the garden like tabs in a developer\'s browser. Closing them is not an option.',
  'The {type} population ({count}) has entered "we need a bigger garden" territory.',
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
  'Emergency state: {remaining} active entities. Recovery odds are steep.',
  'System integrity compromised. Only {remaining} lives remain in circulation.',
  '{remaining} entities left. The garden is giving "last day at a dying startup" energy.',
  'Population: {remaining}. The ecosystem is running on fumes, hope, and a single fungus probably.',
  '{remaining} survivors remain. This is no longer a garden. This is a support group.',
  'Down to {remaining}. If this were a movie, the soundtrack would be a single violin.',
  'The garden has {remaining} inhabitants. The vibe has shifted from "ecosystem" to "post-credits scene."',
  '{remaining} entities cling to existence like uncommitted changes before a force push.',
  'CRITICAL ALERT: {remaining} entities remaining. The garden\'s uptime SLA is in jeopardy.',
  '{remaining} left alive. The garden stares into the void. The void stares back. The void has better population numbers.',
  'Only {remaining} remain. This garden is one bad tick away from becoming a screensaver.',
  '{remaining} survivors. The garden is so empty, the fungi are starting to get existential.',
];

// ==========================================
// Population Delta Templates
// ==========================================

const POPULATION_DELTA_PLANT_GAIN_TEMPLATES: readonly string[] = [
  'Plants flourish: {delta} new plants this tick. The green carpet spreads.',
  'A bloom of {delta} new plants. The herbivores rub their mandibles together.',
  'Plant population surges by {delta}. Photosynthesis is having a good day.',
  '+{delta} plants. The garden floor turns greener. The grazers approve.',
  'Green wave detected: +{delta} plants and counting.',
  'Flora patch deployed successfully: {delta} new plants online.',
  '+{delta} plants! The garden floor is getting gentrified by chlorophyll.',
  '{delta} new plants sprout up like microservices in a startup that just got funding.',
  'Plant surge: +{delta}. The herbivores just sent a Slack message: "the buffet is open."',
  'The plant kingdom adds {delta} new citizens. Green is literally the new green.',
  '+{delta} plants. At this rate, the garden will need a second garden.',
  '{delta} plants bloom simultaneously. The sun takes a bow.',
];

const POPULATION_DELTA_PLANT_LOSS_TEMPLATES: readonly string[] = [
  '{absDelta} plants lost this tick. The green is fading.',
  'The plant population drops by {absDelta}. Something is eating faster than it grows.',
  '-{absDelta} plants. The herbivores may have overdone it.',
  'Plants decline by {absDelta}. The food chain trembles from the bottom up.',
  'Botanical rollback: {absDelta} plants removed from active service.',
  'Plant losses hit {absDelta}. The base of the pyramid is feeling it.',
  '-{absDelta} plants. The foundation of the food chain just filed for bankruptcy.',
  '{absDelta} plants gone. The herbivores start nervously checking their savings accounts.',
  'Plant population drops by {absDelta}. This is fine. Everything is fine. (It is not fine.)',
  '{absDelta} fewer plants. The photosynthesis department is downsizing.',
  '-{absDelta} plants this tick. The salad bar is closing. The grazers are panicking.',
  'DELETE FROM plants LIMIT {absDelta}; — the ecosystem runs queries without WHERE clauses now.',
];

const POPULATION_DELTA_HERBIVORE_GAIN_TEMPLATES: readonly string[] = [
  'Herbivore numbers climb by {delta}. More mouths, more problems.',
  '+{delta} herbivores. The plants just got more popular (involuntarily).',
  'The grazer population swells by {delta}. The carnivores sharpen their focus.',
  '{delta} new herbivores join the fray. The ecosystem adjusts.',
  'Grazer boom: +{delta}. Salad demand spikes immediately.',
  'Herbivore queue expands by {delta}. Carnivore interest follows.',
  '+{delta} herbivores! The carnivores just updated their grocery list.',
  '{delta} new grazers enter the arena. The plants sigh collectively. The carnivores smile individually.',
  'Herbivore population bumps by {delta}. The food chain just grew a thicker middle.',
  '+{delta} grazers. The carnivore Yelp reviews are about to get a lot more positive.',
  '{delta} new herbivores. Each one a story. Each one potentially a meal.',
  'Herbivore influx: +{delta}. Supply chains for both food and being food are expanding.',
];

const POPULATION_DELTA_HERBIVORE_LOSS_TEMPLATES: readonly string[] = [
  '{absDelta} herbivores lost. The predators or starvation or both.',
  'Herbivore population drops by {absDelta}. The food chain is ruthless.',
  '-{absDelta} grazers. The plants breathe easier. The carnivores do not.',
  'The herbivore count falls by {absDelta}. Somewhere, a predator goes hungry tonight.',
  'Herbivore count takes a {absDelta}-point hit. Predation and scarcity leave receipts.',
  '{absDelta} fewer grazers in circulation. The ecosystem rebalances the hard way.',
  '-{absDelta} herbivores. The carnivores have been eating well. The plants have been thriving. Circle of life, baby.',
  '{absDelta} grazers down. The population graph looks like a crypto chart.',
  'Herbivore losses: {absDelta}. Somewhere, a carnivore just had the best meal of its life.',
  '-{absDelta} herbivores this tick. The middle of the food chain is having a really bad day.',
  '{absDelta} fewer herbivores. The carnivores are full and the plants are relieved. Peak equilibrium content.',
  'Herbivore population takes an L: -{absDelta}. Nature giveth and nature absolutely taketh.',
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
  const positiveCommentaries = [
    'An upgrade, courtesy of random chance.',
    'Evolution ships a buff. No sprint planning required.',
    'Congratulations, you have been promoted by your own DNA.',
    'Nature said "here, have a bonus." No strings attached. Probably.',
    'A rare W from the mutation lottery.',
  ];

  const negativeCommentaries = [
    'Not every mutation is an improvement.',
    'Evolution nerfs another build. Patch notes were not consulted.',
    'Sometimes your DNA just hates you. This is one of those times.',
    'Natural selection will have opinions about this one.',
    'The gene pool giveth and the gene pool taketh away.',
  ];

  if (percentChange > 0) {
    return {
      direction: 'stronger',
      adjective: 'more useful',
      verb: 'improve',
      commentary: pickRandomElement([...positiveCommentaries]) ?? positiveCommentaries[0],
    };
  }
  return {
    direction: 'weaker',
    adjective: 'less efficient',
    verb: 'degrade',
    commentary: pickRandomElement([...negativeCommentaries]) ?? negativeCommentaries[0],
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
