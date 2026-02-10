export function createWordTokenSet(...parts: string[]): Set<string> {
  const normalizedText = parts.join(' ').toLowerCase();
  return new Set(normalizedText.split(/[^a-z]+/).filter(Boolean));
}

export function hasAnyToken(tokens: Set<string>, candidates: readonly string[]): boolean {
  for (const candidate of candidates) {
    if (tokens.has(candidate)) {
      return true;
    }
  }
  return false;
}

export function hasAllTokens(tokens: Set<string>, required: readonly string[]): boolean {
  for (const token of required) {
    if (!tokens.has(token)) {
      return false;
    }
  }
  return true;
}

export function pickDeterministicType<T extends string>(
  fallbackOrder: readonly T[],
  primaryKey: string,
  secondaryKey: string = ''
): T {
  const fallbackKey = primaryKey.trim().toLowerCase() || secondaryKey.trim().toLowerCase();
  const hash = fallbackKey.split('').reduce((accumulator, character) => {
    return ((accumulator << 5) - accumulator) + character.charCodeAt(0);
  }, 0);

  return fallbackOrder[Math.abs(hash) % fallbackOrder.length] ?? fallbackOrder[0];
}
