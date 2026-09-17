/**
 * Chaos Garden - Simulation Configuration & Physical Universal Constants
 */

export interface SimulationConfig {
  /** Canvas / World coordinate width */
  gardenWidth: number;
  /** Canvas / World coordinate height */
  gardenHeight: number;
  /** Default physics ticks per second */
  targetTps: number;

  /** Population ceilings to prevent unbounded exponential explosion */
  maxPlants: number;
  maxHerbivores: number;
  maxCarnivores: number;
  maxFungi: number;
  maxTotalEntities: number;

  /** Minimum energy required for reproduction by kingdom */
  plantReproductionThreshold: number;
  herbivoreReproductionThreshold: number;
  carnivoreReproductionThreshold: number;
  fungusReproductionThreshold: number;

  /** Base metabolic drain applied per tick */
  baseEnergyCostPerTick: number;
  /** Base photosynthetic conversion rate from full sunlight */
  basePhotosynthesisRate: number;

  /** Genetic mutation rates */
  mutationProbability: number;
  mutationMagnitude: number;

  /** Initial ecosystem bootstrap population */
  initialPlants: number;
  initialHerbivores: number;
  initialCarnivores: number;
  initialFungi: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  gardenWidth: 1600,
  gardenHeight: 1200,
  targetTps: 60,

  maxPlants: 1000,
  maxHerbivores: 500,
  maxCarnivores: 200,
  maxFungi: 300,
  maxTotalEntities: 2000,

  // Trophically ordered reproduction thresholds: plants < herbivores < carnivores
  plantReproductionThreshold: 55,
  herbivoreReproductionThreshold: 65,
  carnivoreReproductionThreshold: 75,
  fungusReproductionThreshold: 70,

  baseEnergyCostPerTick: 0.025,
  basePhotosynthesisRate: 0.06,

  mutationProbability: 0.15,
  mutationMagnitude: 0.15,

  initialPlants: 60,
  initialHerbivores: 20,
  initialCarnivores: 6,
  initialFungi: 12,
};

