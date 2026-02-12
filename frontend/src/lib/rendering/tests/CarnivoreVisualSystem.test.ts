import { describe, expect, it } from 'vitest';
import { generateCarnivoreVisual } from '../CarnivoreVisualSystem.ts';

describe('CarnivoreVisualSystem', () => {
  const mockTraits = {
    reproductionRate: 0.05,
    movementSpeed: 1.5,
    metabolismEfficiency: 1.0,
    perceptionRadius: 100,
  };

  const createMockEntity = (id: string, name: string, species: string) => ({
    id,
    name,
    species,
    health: 100,
    energy: 100,
    position: { x: 0, y: 0 },
    traits: mockTraits,
  });

  it('assigns "raptor" type based on avian keywords', () => {
    const entity = createMockEntity('1', 'Hawk-strike', 'Bird');
    const visual = generateCarnivoreVisual(entity as any);
    expect(visual.predatorType).toBe('raptor');
  });

  it('assigns "serpent" type based on reptilian keywords', () => {
    const entity = createMockEntity('2', 'Viper-bite', 'Snake');
    const visual = generateCarnivoreVisual(entity as any);
    expect(visual.predatorType).toBe('serpent');
  });

  it('uses reddish-themed color schemes for all carnivores', () => {
    const types = ['Wolf-hunt', 'Hawk-dive', 'Viper-hiss'];
    
    types.forEach((name, index) => {
      const entity = createMockEntity(String(index), name, 'Carnivore');
      const visual = generateCarnivoreVisual(entity as any);
      
      const baseHueMatch = visual.baseColor.match(/hsl\((\d+),/);
      const baseHue = baseHueMatch ? parseInt(baseHueMatch[1], 10) : -1;
      
      const normalizedHue = baseHue % 360;
      // Broad reddish range
      const isReddishHue = (normalizedHue >= 0 && normalizedHue <= 120) || (normalizedHue >= 260 && normalizedHue <= 360);
      if (!isReddishHue) {
        console.log(`Failed Hue: ${normalizedHue} for ${name}`);
      }
      expect(isReddishHue).toBe(true);
    });
  });

  it('assigns correct leg counts for each type', () => {
    const cases = [
      { name: 'Wolf', expectedLegs: 4 },
      { name: 'Hawk', expectedLegs: 2 },
      { name: 'Viper', expectedLegs: 0 },
    ];

    cases.forEach(({ name, expectedLegs }) => {
      const entity = createMockEntity(name, name, 'Carnivore');
      const visual = generateCarnivoreVisual(entity as any);
      expect(visual.legCount).toBe(expectedLegs);
    });
  });
});
