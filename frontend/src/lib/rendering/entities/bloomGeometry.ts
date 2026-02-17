const MAX_PETAL_RADIUS = 6.5;

const MAX_FLOWER_BLOOM_SIZE = MAX_PETAL_RADIUS * 2.5;
const MAX_FLOWER_CENTER_RADIUS = MAX_PETAL_RADIUS * 0.45;
const MAX_FLOWER_STAMEN_ORBIT = MAX_PETAL_RADIUS * 0.23;

const MAX_LILY_BLOOM_SIZE = MAX_PETAL_RADIUS * 2.2;
const MAX_LILY_PETAL_WIDTH = MAX_PETAL_RADIUS * 1.05;
const MAX_LILY_PETAL_HEIGHT = MAX_PETAL_RADIUS * 0.52;
const MAX_LILY_CENTER_RADIUS = MAX_PETAL_RADIUS * 0.42;
const MAX_LILY_TUBE_WIDTH = MAX_PETAL_RADIUS * 0.75;
const MAX_LILY_TUBE_HEIGHT = MAX_PETAL_RADIUS * 0.86;

export const BLOOM_GEOMETRY_LIMITS = {
  maxPetalRadius: MAX_PETAL_RADIUS,
  maxFlowerBloomSize: MAX_FLOWER_BLOOM_SIZE,
  maxFlowerCenterRadius: MAX_FLOWER_CENTER_RADIUS,
  maxFlowerStamenOrbit: MAX_FLOWER_STAMEN_ORBIT,
  maxLilyBloomSize: MAX_LILY_BLOOM_SIZE,
  maxLilyPetalWidth: MAX_LILY_PETAL_WIDTH,
  maxLilyPetalHeight: MAX_LILY_PETAL_HEIGHT,
  maxLilyCenterRadius: MAX_LILY_CENTER_RADIUS,
  maxLilyTubeWidth: MAX_LILY_TUBE_WIDTH,
  maxLilyTubeHeight: MAX_LILY_TUBE_HEIGHT,
} as const;

export interface FlowerBloomGeometry {
  bloomSize: number;
  outerPetalWidth: number;
  outerPetalHeight: number;
  innerPetalWidth: number;
  innerPetalHeight: number;
  centerRadius: number;
  stamenOrbitRadius: number;
}

export interface LilyBloomGeometry {
  bloomSize: number;
  petalOffsetRadius: number;
  petalWidth: number;
  petalHeight: number;
  tubeWidth: number;
  tubeHeight: number;
  centerRadius: number;
}

export function calculateFlowerBloomGeometry(
  bloomSize: number,
  petalStretch: number,
): FlowerBloomGeometry {
  const cappedBloomSize = Math.min(bloomSize, MAX_FLOWER_BLOOM_SIZE);

  return {
    bloomSize: cappedBloomSize,
    outerPetalWidth: Math.min(cappedBloomSize * 0.35 * petalStretch, MAX_PETAL_RADIUS),
    outerPetalHeight: Math.min(cappedBloomSize * 0.17, MAX_PETAL_RADIUS * 0.5),
    innerPetalWidth: Math.min(cappedBloomSize * 0.22 * petalStretch, MAX_PETAL_RADIUS * 0.6),
    innerPetalHeight: Math.min(cappedBloomSize * 0.1, MAX_PETAL_RADIUS * 0.3),
    centerRadius: Math.min(cappedBloomSize * 0.18, MAX_FLOWER_CENTER_RADIUS),
    stamenOrbitRadius: Math.min(cappedBloomSize * 0.09, MAX_FLOWER_STAMEN_ORBIT),
  };
}

export function calculateLilyBloomGeometry(bloomSize: number): LilyBloomGeometry {
  const cappedBloomSize = Math.min(bloomSize, MAX_LILY_BLOOM_SIZE);

  return {
    bloomSize: cappedBloomSize,
    petalOffsetRadius: Math.min(cappedBloomSize * 0.3, MAX_LILY_PETAL_WIDTH * 0.6),
    petalWidth: Math.min(cappedBloomSize * 0.5, MAX_LILY_PETAL_WIDTH),
    petalHeight: Math.min(cappedBloomSize * 0.25, MAX_LILY_PETAL_HEIGHT),
    tubeWidth: Math.min(cappedBloomSize * 0.35, MAX_LILY_TUBE_WIDTH),
    tubeHeight: Math.min(cappedBloomSize * 0.4, MAX_LILY_TUBE_HEIGHT),
    centerRadius: Math.min(cappedBloomSize * 0.15, MAX_LILY_CENTER_RADIUS),
  };
}
