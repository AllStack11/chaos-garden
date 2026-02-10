/**
 * Environment Constants
 * 
 * The immutable laws that govern our garden's climate—
 * the boundaries within which weather patterns dance.
 * 
 * These values shape the rhythm of seasons, the intensity of storms,
 * and the thresholds that define habitable conditions.
 */

/** Day length in ticks (for day/night cycles) */
export const TICKS_PER_DAY = 96; // 15 minutes * 96 = 24 hours

/** Probability of weather change per tick */
export const WEATHER_CHANGE_PROBABILITY = 0.05; // 5% chance per tick

/** Maximum change in temperature per tick */
export const MAX_TEMPERATURE_CHANGE = 2.0; // ±2°C per tick

/** Maximum change in moisture per tick */
export const MAX_MOISTURE_CHANGE = 0.05; // ±5% per tick

/** Minimum temperature for life (Celsius) */
export const MINIMUM_TEMPERATURE_FOR_LIFE = 0;

/** Maximum temperature for life (Celsius) */
export const MAXIMUM_TEMPERATURE_FOR_LIFE = 40;

/** Minimum moisture for life (0-1 scale) */
export const MINIMUM_MOISTURE_FOR_LIFE = 0;

/** Maximum moisture for life (0-1 scale) */
export const MAXIMUM_MOISTURE_FOR_LIFE = 1;

/** Drought threshold - moisture below this causes stress */
export const DROUGHT_THRESHOLD = 0.2; // 20%

/** Heavy rain threshold - moisture above this is abundant */
export const HEAVY_RAIN_THRESHOLD = 0.8; // 80%

/** Heat wave threshold - temperature above this causes stress */
export const HEAT_WAVE_THRESHOLD = 35; // 35°C

/** Freeze threshold - temperature below this causes stress */
export const FREEZE_THRESHOLD = 5; // 5°C

/** Ideal temperature for most life (Celsius) */
export const IDEAL_TEMPERATURE = 20;

/** Ideal temperature for metabolism (Celsius) */
export const IDEAL_METABOLISM_TEMPERATURE = 25;

/** Ideal moisture for plant growth (0-1 scale) */
export const IDEAL_MOISTURE_FOR_PLANTS = 0.5; // 50%

/** Maximum photosynthesis multiplier at ideal moisture */
export const MAX_PHOTOSYNTHESIS_MULTIPLIER = 1.5;

/** Minimum photosynthesis multiplier at extreme moisture */
export const MIN_PHOTOSYNTHESIS_MULTIPLIER = 0.5;

/** Maximum metabolism multiplier at ideal temperature */
export const MAX_METABOLISM_MULTIPLIER = 1.5;

/** Minimum metabolism multiplier at extreme temperature */
export const MIN_METABOLISM_MULTIPLIER = 0.5;

/** Temperature deviation for mild penalty */
export const MILD_TEMPERATURE_DEVIATION = 10; // ±10°C from ideal

/** Temperature deviation for severe penalty */
export const SEVERE_TEMPERATURE_DEVIATION = 20; // ±20°C from ideal

/** Health penalty multiplier for mild temperature deviation */
export const MILD_HEALTH_PENALTY_MULTIPLIER = 0.1;

/** Energy penalty multiplier for mild temperature deviation */
export const MILD_ENERGY_PENALTY_MULTIPLIER = 0.05;

/** Health penalty multiplier for severe temperature deviation */
export const SEVERE_HEALTH_PENALTY_MULTIPLIER = 0.3;

/** Energy penalty multiplier for severe temperature deviation */
export const SEVERE_ENERGY_PENALTY_MULTIPLIER = 0.2;

/** Drought stress energy penalty */
export const DROUGHT_STRESS_ENERGY_PENALTY = 0.4;

// ==========================================
// Predator-Prey Perception Constants
// ==========================================

/** Default threat detection radius for herbivores (pixels) */
export const THREAT_DETECTION_RADIUS_DEFAULT = 130;

/** Minimum threat detection radius (mutation floor) */
export const MIN_THREAT_DETECTION_RADIUS = 80;

/** Maximum threat detection radius (mutation ceiling) */
export const MAX_THREAT_DETECTION_RADIUS = 200;

/** Ambush radius for carnivores - close-range stealth advantage (pixels) */
export const AMBUSH_RADIUS = 35;

/** Pack coordination radius - carnivores avoid competing within this range (pixels) */
export const PACK_COORDINATION_RADIUS = 100;

// ==========================================
// Fleeing Behavior Constants
// ==========================================

/** Speed multiplier when fleeing (herbivore fleeSpeed = movementSpeed * multiplier) */
export const FLEE_SPEED_MULTIPLIER = 1.35;

/** Energy cost multiplier when fleeing (more expensive than normal movement) */
export const FLEE_ENERGY_COST_MULTIPLIER = 1.6;

/** Panic threshold distance when energy is low (flee earlier when weak) */
export const PANIC_THRESHOLD_LOW_ENERGY = 150;

/** Panic threshold distance when energy is high (flee later when strong) */
export const PANIC_THRESHOLD_HIGH_ENERGY = 100;

/** Consecutive fleeing ticks before exhaustion sets in */
export const EXHAUSTION_THRESHOLD_TICKS = 15;

/** Speed reduction when exhausted (0.6 = 40% penalty) */
export const EXHAUSTION_SPEED_PENALTY = 0.6;

/** Ticks of non-fleeing required to recover from exhaustion */
export const RECOVERY_TICKS_REQUIRED = 5;

/** Probability of zigzag juke per tick when threat is close */
export const ZIGZAG_PROBABILITY = 0.3;

/** Angular deviation for zigzag evasion (degrees) */
export const ZIGZAG_ANGLE_DEVIATION = 45;

/** Distance from garden edge to trigger boundary avoidance (pixels) */
export const BOUNDARY_AVOIDANCE_THRESHOLD = 50;

// ==========================================
// Hunting Behavior Constants
// ==========================================

/** Stalking speed multiplier when within ambush radius */
export const STALKING_SPEED_MULTIPLIER = 0.5;

/** Energy cost multiplier when stalking (lower than normal) */
export const STALKING_ENERGY_COST_MULTIPLIER = 0.7;

/** Ticks spent hunting before abandoning target */
export const HUNT_ABANDONMENT_TICKS = 25;

/** Energy threshold above which carnivore enters resting state */
export const RESTING_ENERGY_THRESHOLD = 80;

/** Speed multiplier when resting/conserving energy */
export const RESTING_SPEED_MULTIPLIER = 0.5;

/** Metabolism reduction when resting */
export const RESTING_METABOLISM_MULTIPLIER = 0.8;
