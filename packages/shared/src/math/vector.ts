/**
 * Chaos Garden - High-Performance 2D Vector Math
 * 
 * Optimized mathematical operations for boid steering forces,
 * physics velocity integration, and proximity queries.
 */

import type { Vector2D } from '../types/spatial.js';

export function vec2(x: number = 0, y: number = 0): Vector2D {
  return { x, y };
}

export function add(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vector2D, scalar: number): Vector2D {
  return { x: v.x * scalar, y: v.y * scalar };
}

export function dot(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

export function magnitudeSq(v: Vector2D): number {
  return v.x * v.x + v.y * v.y;
}

export function magnitude(v: Vector2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function distanceSq(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Vector2D, b: Vector2D): number {
  return Math.sqrt(distanceSq(a, b));
}

export function normalize(v: Vector2D): Vector2D {
  const m = magnitude(v);
  if (m === 0) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

export function limit(v: Vector2D, max: number): Vector2D {
  const mSq = magnitudeSq(v);
  if (mSq > max * max) {
    const m = Math.sqrt(mSq);
    return { x: (v.x / m) * max, y: (v.y / m) * max };
  }
  return { x: v.x, y: v.y };
}

export function setMagnitude(v: Vector2D, mag: number): Vector2D {
  return scale(normalize(v), mag);
}

export function heading(v: Vector2D): number {
  return Math.atan2(v.y, v.x);
}

export function fromAngle(angle: number, length: number = 1): Vector2D {
  return {
    x: Math.cos(angle) * length,
    y: Math.sin(angle) * length,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;
  let result = (value - min) % range;
  if (result < 0) result += range;
  return result + min;
}

