import { describe, expect, it } from 'vitest';
import {
  createWordTokenSet,
  hasAllTokens,
  hasAnyToken,
  pickDeterministicType,
} from '../visualTypeClassifier.ts';

describe('rendering/visualTypeClassifier', () => {
  it('creates normalized word token sets from mixed input strings', () => {
    const tokens = createWordTokenSet('Glow-Spore 2000', 'Mold_cluster');

    expect(tokens.has('glow')).toBe(true);
    expect(tokens.has('spore')).toBe(true);
    expect(tokens.has('mold')).toBe(true);
    expect(tokens.has('cluster')).toBe(true);
    expect(tokens.has('2000')).toBe(false);
  });

  it('checks candidate tokens correctly', () => {
    const tokens = createWordTokenSet('night hunter fox');

    expect(hasAnyToken(tokens, ['wolf', 'fox'])).toBe(true);
    expect(hasAnyToken(tokens, ['wolf', 'cat'])).toBe(false);
    expect(hasAllTokens(tokens, ['night', 'hunter'])).toBe(true);
    expect(hasAllTokens(tokens, ['night', 'wolf'])).toBe(false);
  });

  it('picks deterministic fallback types and uses secondary key when primary is blank', () => {
    const fallbackOrder = ['alpha', 'beta', 'gamma'] as const;

    const first = pickDeterministicType(fallbackOrder, '', 'Fallback Species');
    const second = pickDeterministicType(fallbackOrder, '', 'Fallback Species');

    expect(first).toBe(second);
    expect(fallbackOrder).toContain(first);
  });
});
