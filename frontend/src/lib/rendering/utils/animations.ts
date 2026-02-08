/**
 * Animation Utilities for Procedural Entity Rendering
 * 
 * Provides easing functions, animation curves, and procedural
 * animation helpers for organic, biological-feeling motion.
 */

// ==========================================
// Easing Functions
// ==========================================

/**
 * Smooth step - gentle acceleration and deceleration
 */
export function easeInOutSmooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Sine easing - soft, natural feel
 */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Cubic easing - smoother, more pronounced
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Bounce easing - like something bouncing
 */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Elastic easing - springy, like organic tissue
 */
export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * Back easing - overshoot before settling
 */
export function easeInOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return t < 0.5 ? Math.pow(2 * t, 2) * ((c3 + 1) * 2 * t - c3) / 2 : (Math.pow(2 * t - 2, 2) * ((c3 + 1) * (t * 2 - 2) + c3) + 2) / 2;
}

// ==========================================
// Biological Animation Presets
// ==========================================

/**
 * Breathing animation - slow, rhythmic
 */
export function breathingAnimation(
  time: number,
  speed: number = 1,
  intensity: number = 1
): number {
  // ~6 second full cycle at default speed
  return (Math.sin(time * speed) + 1) / 2 * intensity;
}

/**
 * Heartbeat animation - two beats then pause
 */
export function heartbeatAnimation(time: number): number {
  const beatInterval = 0.25; // seconds between beats
  const cycle = time % beatInterval;
  
  if (cycle < 0.08) {
    return 1 - cycle / 0.08;
  } else if (cycle < 0.16) {
    return cycle / 0.16;
  } else if (cycle < 0.24) {
    return 1 - (cycle - 0.16) / 0.08;
  } else {
    return (cycle - 0.24) / (beatInterval - 0.24);
  }
}

/**
 * Wing flap animation
 */
export function wingFlapAnimation(
  time: number,
  speed: number = 5,
  maxAngle: number = 0.5
): number {
  return Math.sin(time * speed) * maxAngle;
}

/**
 * Antenna wave animation - slow, curious movement
 */
export function antennaWaveAnimation(
  time: number,
  speed: number = 2
): number {
  return Math.sin(time * speed) * 0.3;
}

/**
 * Leg walking animation - tripod gait for insects
 */
export function legWalkAnimation(
  legIndex: number,
  time: number,
  speed: number = 8
): number {
  // Offset each leg for natural walking pattern
  const phase = (legIndex * Math.PI) / 3;
  return Math.sin(time * speed + phase) * 0.3;
}

/**
 * Plant sway in wind
 */
export function plantSwayAnimation(
  entityX: number,
  time: number,
  windIntensity: number = 1
): number {
  // Position-dependent sway for organic wave effect
  const positionOffset = entityX * 0.01;
  return Math.sin(time * 2 + positionOffset) * 0.1 * windIntensity;
}

/**
 * Flower following sun (heliotropism)
 */
export function heliotropismAnimation(
  sunlight: number, // 0-1
  time: number
): number {
  // More pronounced when sunlight is strong
  const sunFactor = sunlight * 0.3;
  return Math.sin(time * 0.5) * sunFactor;
}

/**
 * Spore floating animation
 */
export function sporeFloatAnimation(
  time: number,
  speed: number = 1
): number {
  // Compound motion - up/down + rotation
  const vertical = Math.sin(time * speed) * 0.5;
  const horizontal = Math.cos(time * speed * 0.7) * 0.3;
  return vertical + horizontal;
}

/**
 * Creature bob while walking
 */
export function walkBobAnimation(
  time: number,
  speed: number = 8
): number {
  return Math.abs(Math.sin(time * speed)) * 2;
}

/**
 * Happiness/excitement wiggle
 */
export function happyWiggleAnimation(
  time: number,
  intensity: number = 1
): number {
  return Math.sin(time * 15) * 0.1 * intensity;
}

/**
 * Fear/shiver animation
 */
export function shiverAnimation(
  time: number,
  intensity: number = 1
): number {
  return (Math.random() - 0.5) * 2 * 0.5 * intensity;
}

/**
 * Growth animation (for birth/evolution)
 */
export function growthAnimation(
  progress: number, // 0-1
  easing: (t: number) => number = easeOutElastic
): number {
  return easing(progress);
}

/**
 * Fade out animation (for death)
 */
export function fadeOutAnimation(
  progress: number, // 0-1 (1 = fully faded)
  easing: (t: number) => number = easeInOutSine
): number {
  return 1 - easing(progress);
}

/**
 * Scale pulse (for attention/selection)
 */
export function scalePulseAnimation(
  time: number,
  selected: boolean
): number {
  if (!selected) return 1;
  return 1 + Math.sin(time * 3) * 0.1;
}

// ==========================================
// Animation State Helpers
// ==========================================

/**
 * Get animation phase for continuous animations
 */
export function getAnimationPhase(
  time: number,
  periodSeconds: number
): number {
  return (time % periodSeconds) / periodSeconds;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Smooth damp - approaches target gradually
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: { current: number },
  smoothTime: number,
  deltaTime: number,
  maxSpeed: number = Infinity
): number {
  // Based on SmoothDamp from Unity
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  
  let change = current - target;
  const originalTo = target;
  
  // Clamp to max speed
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  
  target = current - change;
  
  const temp = (velocity.current + omega * change) * deltaTime;
  velocity.current = (velocity.current - omega * temp) * exp;
  
  let output = target + (change + temp) * exp;
  
  // Ensure we don't overshoot
  if (originalTo - current > 0.01) {
    output = clamp(output, originalTo, Infinity);
  } else if (originalTo - current < -0.01) {
    output = clamp(output, -Infinity, originalTo);
  }
  
  return output;
}

/**
 * Random float between min and max
 */
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Random item from array
 */
export function randomFromArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Noise function for organic randomness
 */
export function simpleNoise(
  x: number,
  y: number = 0,
  seed: number = 0
): number {
  // Simple value noise
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Perlin-like noise for smooth variations
 */
export function smoothNoise(
  x: number,
  y: number = 0,
  scale: number = 1
): number {
  const scaledX = x * scale;
  const scaledY = y * scale;
  
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  
  const sx = scaledX - x0;
  const sy = scaledY - y0;
  
  // Smooth step for interpolation
  const nx0 = easeInOutSmooth(sx);
  const nx1 = easeInOutSmooth(sx);
  
  const noise00 = simpleNoise(x0, y0);
  const noise10 = simpleNoise(x1, y0);
  const noise01 = simpleNoise(x0, y1);
  const noise11 = simpleNoise(x1, y1);
  
  const ix0 = lerp(noise00, noise10, nx0);
  const ix1 = lerp(noise01, noise11, nx0);
  
  return lerp(ix0, ix1, easeInOutSmooth(sy));
}

// ==========================================
// Time Helpers
// ==========================================

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Get current time in seconds
 */
export function nowInSeconds(): number {
  return Date.now() / 1000;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Format age ticks for display
 */
export function formatAge(ticks: number, tickIntervalMinutes: number = 15): string {
  const totalHours = ticks * tickIntervalMinutes / 60;
  
  if (totalHours < 1) {
    return `${ticks} ticks`;
  } else if (totalHours < 24) {
    return `${totalHours.toFixed(1)} hours`;
  } else {
    const days = totalHours / 24;
    return `${days.toFixed(1)} days`;
  }
}

// ==========================================
// Animation Configuration
// ==========================================

export const ANIMATION_CONFIG = {
  breathSpeed: 1,           // Multiplier for breathing
  wingFlapSpeed: 5,          // Wing flap frequency
  walkSpeed: 8,             // Walking animation speed
  swaySpeed: 2,             // Plant sway frequency
  pulseSpeed: 3,            // Selection pulse frequency
  birthDuration: 500,       // ms for birth animation
  deathDuration: 1000,      // ms for death animation
  eatDuration: 300,         // ms for eating animation
  fadeSpeed: 0.01,          // Opacity change per frame
  bobAmount: 2,             // Pixels for walk bob
  swayAmount: 0.1,         // Radians for plant sway
} as const;

// ==========================================
// Type Aliases
// ==========================================

export type EasingFunction = (t: number) => number;
