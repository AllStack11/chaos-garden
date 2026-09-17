import { describe, it, expect } from 'vitest';
import {
  vec2,
  add,
  sub,
  scale,
  dot,
  magnitude,
  magnitudeSq,
  distance,
  distanceSq,
  normalize,
  limit,
  setMagnitude,
  heading,
  fromAngle,
  clamp,
  lerp,
  wrap,
  addMut,
  subMut,
  scaleMut,
  limitMut,
  normalizeMut,
  distSq,
  dist,
} from '../src/math/vector.js';

describe('Vector Math Primitives', () => {
  it('creates vectors with correct coordinates', () => {
    const v = vec2(10, 20);
    expect(v.x).toBe(10);
    expect(v.y).toBe(20);
  });

  it('performs basic vector arithmetic', () => {
    const a = vec2(3, 4);
    const b = vec2(1, 2);

    expect(add(a, b)).toEqual({ x: 4, y: 6 });
    expect(sub(a, b)).toEqual({ x: 2, y: 2 });
    expect(scale(a, 2)).toEqual({ x: 6, y: 8 });
    expect(dot(a, b)).toBe(3 * 1 + 4 * 2);
  });

  it('computes magnitudes and distances correctly', () => {
    const a = vec2(3, 4);
    const b = vec2(0, 0);

    expect(magnitudeSq(a)).toBe(25);
    expect(magnitude(a)).toBe(5);
    expect(distanceSq(a, b)).toBe(25);
    expect(distance(a, b)).toBe(5);
  });

  it('normalizes vectors and handles zero vectors safely', () => {
    const v = vec2(3, 4);
    const norm = normalize(v);
    expect(norm.x).toBeCloseTo(0.6);
    expect(norm.y).toBeCloseTo(0.8);
    expect(magnitude(norm)).toBeCloseTo(1.0);

    const zero = vec2(0, 0);
    expect(normalize(zero)).toEqual({ x: 0, y: 0 });
  });

  it('limits vector magnitude', () => {
    const v = vec2(30, 40); // mag = 50
    const capped = limit(v, 10);
    expect(magnitude(capped)).toBeCloseTo(10);
    expect(capped.x).toBeCloseTo(6);
    expect(capped.y).toBeCloseTo(8);

    const small = vec2(1, 1);
    expect(limit(small, 10)).toEqual({ x: 1, y: 1 });
  });

  it('sets magnitude correctly', () => {
    const v = vec2(3, 4);
    const scaled = setMagnitude(v, 25);
    expect(magnitude(scaled)).toBeCloseTo(25);
  });

  it('handles heading and angle conversions', () => {
    const v = vec2(1, 0);
    expect(heading(v)).toBeCloseTo(0);

    const up = vec2(0, 1);
    expect(heading(up)).toBeCloseTo(Math.PI / 2);

    const from0 = fromAngle(0, 5);
    expect(from0.x).toBeCloseTo(5);
    expect(from0.y).toBeCloseTo(0);
  });

  it('clamps values within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('linearly interpolates between numbers', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 0.25)).toBe(25);
  });

  it('wraps values around toroidal boundaries', () => {
    expect(wrap(105, 0, 100)).toBe(5);
    expect(wrap(-5, 0, 100)).toBe(95);
    expect(wrap(50, 0, 100)).toBe(50);
  });

  describe('In-Place Vector Mutations (Zero Allocation)', () => {
    it('mutates target vector with addMut', () => {
      const out = vec2(0, 0);
      const a = vec2(3, 4);
      const b = vec2(1, 2);
      const res = addMut(out, a, b);
      expect(res).toBe(out);
      expect(out.x).toBe(4);
      expect(out.y).toBe(6);
    });

    it('mutates target vector with subMut', () => {
      const out = vec2(0, 0);
      const a = vec2(5, 7);
      const b = vec2(2, 3);
      const res = subMut(out, a, b);
      expect(res).toBe(out);
      expect(out.x).toBe(3);
      expect(out.y).toBe(4);
    });

    it('mutates target vector with scaleMut', () => {
      const out = vec2(3, 4);
      const res = scaleMut(out, out, 2.5);
      expect(res).toBe(out);
      expect(out.x).toBe(7.5);
      expect(out.y).toBe(10);
    });

    it('mutates target vector with limitMut', () => {
      const out = vec2(30, 40); // magnitude 50
      const res = limitMut(out, out, 10);
      expect(res).toBe(out);
      expect(magnitude(out)).toBeCloseTo(10);
      expect(out.x).toBeCloseTo(6);
      expect(out.y).toBeCloseTo(8);

      const small = vec2(1, 1);
      limitMut(small, small, 10);
      expect(small.x).toBe(1);
      expect(small.y).toBe(1);
    });

    it('mutates target vector with normalizeMut', () => {
      const out = vec2(3, 4);
      const res = normalizeMut(out, out);
      expect(res).toBe(out);
      expect(out.x).toBeCloseTo(0.6);
      expect(out.y).toBeCloseTo(0.8);
      expect(magnitude(out)).toBeCloseTo(1.0);

      const zero = vec2(0, 0);
      normalizeMut(zero, zero);
      expect(zero.x).toBe(0);
      expect(zero.y).toBe(0);
    });

    it('computes scalar distance and distance squared without Vector2D allocations', () => {
      expect(distSq(1, 2, 4, 6)).toBe(25);
      expect(dist(1, 2, 4, 6)).toBe(5);
      expect(distSq(0, 0, 0, 0)).toBe(0);
      expect(dist(0, 0, 0, 0)).toBe(0);
    });
  });
});


