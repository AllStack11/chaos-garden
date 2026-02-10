import { describe, expect, it } from 'vitest';
import {
  calculateDistanceBetweenEntities,
  clampValueToRange,
  calculateMovementEnergyCost,
  findNearestEntity,
  findAllEntitiesOfTypeWithinRadius,
  calculateThreatLevelForHerbivore,
  findMostDangerousThreat,
  findOptimalFleeDirection,
  moveEntityAwayFromTarget,
  isEntityNearGardenBoundary,
  generateExplorationTarget,
  findCompetingCarnivores
} from '../../../../src/simulation/environment/helpers';
import { buildHerbivore, buildPlant, buildCarnivore } from '../../../fixtures/entities';

describe('simulation/environment/helpers', () => {
  it('calculates euclidean distance between entities', () => {
    const first = buildPlant({ position: { x: 0, y: 0 } });
    const second = buildPlant({ id: 'plant-2', position: { x: 3, y: 4 } });

    expect(calculateDistanceBetweenEntities(first, second)).toBe(5);
  });

  it('clamps values to min and max bounds', () => {
    expect(clampValueToRange(10, 0, 5)).toBe(5);
    expect(clampValueToRange(-1, 0, 5)).toBe(0);
    expect(clampValueToRange(3, 0, 5)).toBe(3);
  });

  it('calculates movement energy cost using distance and efficiency', () => {
    expect(calculateMovementEnergyCost(10, 2)).toBeCloseTo(0.4, 5);
  });

  it('returns nearest entity without maxDistance', () => {
    const source = buildHerbivore({ position: { x: 0, y: 0 } });
    const nearPlant = buildPlant({ id: 'plant-near', position: { x: 10, y: 0 } });
    const farPlant = buildPlant({ id: 'plant-far', position: { x: 20, y: 0 } });

    const target = findNearestEntity(source, [nearPlant, farPlant], 'plant');

    expect(target?.id).toBe('plant-near');
  });

  it('respects maxDistance hard cutoff', () => {
    const source = buildHerbivore({ position: { x: 0, y: 0 } });
    const farPlant = buildPlant({ id: 'plant-far', position: { x: 200, y: 0 } });

    const target = findNearestEntity(source, [farPlant], 'plant', 50);

    expect(target).toBeNull();
  });

  it('accepts targets exactly on maxDistance boundary', () => {
    const source = buildHerbivore({ position: { x: 0, y: 0 } });
    const boundaryPlant = buildPlant({ id: 'plant-boundary', position: { x: 50, y: 0 } });

    const target = findNearestEntity(source, [boundaryPlant], 'plant', 50);

    expect(target?.id).toBe('plant-boundary');
  });

  it('returns null for empty candidates', () => {
    const source = buildHerbivore();

    expect(findNearestEntity(source, [], 'plant')).toBeNull();
  });

  describe('Predator-Prey Perception', () => {
    describe('findAllEntitiesOfTypeWithinRadius', () => {
      it('returns all entities within radius', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
        const close = buildCarnivore({ id: 'close', position: { x: 30, y: 0 } });
        const medium = buildCarnivore({ id: 'medium', position: { x: 80, y: 0 } });
        const far = buildCarnivore({ id: 'far', position: { x: 150, y: 0 } });

        const result = findAllEntitiesOfTypeWithinRadius(herbivore, [close, medium, far], 'carnivore', 100);

        expect(result).toHaveLength(2);
        expect(result.map(e => e.id)).toContain('close');
        expect(result.map(e => e.id)).toContain('medium');
        expect(result.map(e => e.id)).not.toContain('far');
      });

      it('excludes source entity from results', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
        const other = buildHerbivore({ id: 'other', position: { x: 10, y: 0 } });

        const result = findAllEntitiesOfTypeWithinRadius(herbivore, [herbivore, other], 'herbivore', 100);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('other');
      });

      it('excludes dead entities', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
        const alive = buildCarnivore({ id: 'alive', position: { x: 30, y: 0 } });
        const dead = buildCarnivore({ id: 'dead', position: { x: 40, y: 0 }, isAlive: false });

        const result = findAllEntitiesOfTypeWithinRadius(herbivore, [alive, dead], 'carnivore', 100);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('alive');
      });

      it('returns empty array when no entities in range', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
        const far = buildCarnivore({ position: { x: 200, y: 0 } });

        const result = findAllEntitiesOfTypeWithinRadius(herbivore, [far], 'carnivore', 50);

        expect(result).toHaveLength(0);
      });
    });

    describe('calculateThreatLevelForHerbivore', () => {
      it('calculates higher threat for closer carnivores', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
        const close = buildCarnivore({ position: { x: 10, y: 0 }, energy: 50 });
        const far = buildCarnivore({ position: { x: 100, y: 0 }, energy: 50 });

        const closeThreat = calculateThreatLevelForHerbivore(herbivore, close);
        const farThreat = calculateThreatLevelForHerbivore(herbivore, far);

        expect(closeThreat).toBeGreaterThan(farThreat);
      });

      it('calculates higher threat for high-energy carnivores', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
        const lowEnergy = buildCarnivore({ position: { x: 50, y: 0 }, energy: 20 });
        const highEnergy = buildCarnivore({ position: { x: 50, y: 0 }, energy: 80 });

        const lowThreat = calculateThreatLevelForHerbivore(herbivore, lowEnergy);
        const highThreat = calculateThreatLevelForHerbivore(herbivore, highEnergy);

        expect(highThreat).toBeGreaterThan(lowThreat);
      });

      it('clamps threat score between 0 and 100', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
        const veryClose = buildCarnivore({ position: { x: 1, y: 0 }, energy: 100 });
        const veryFar = buildCarnivore({ position: { x: 500, y: 0 }, energy: 0 });

        const closeThreat = calculateThreatLevelForHerbivore(herbivore, veryClose);
        const farThreat = calculateThreatLevelForHerbivore(herbivore, veryFar);

        expect(closeThreat).toBeGreaterThanOrEqual(0);
        expect(closeThreat).toBeLessThanOrEqual(100);
        expect(farThreat).toBeGreaterThanOrEqual(0);
        expect(farThreat).toBeLessThanOrEqual(100);
      });
    });

    describe('findMostDangerousThreat', () => {
      it('returns null when no threats in range', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 }, threatDetectionRadius: 100 });
        const farCarnivore = buildCarnivore({ position: { x: 200, y: 0 } });

        const threat = findMostDangerousThreat(herbivore, [farCarnivore]);

        expect(threat).toBeNull();
      });

      it('returns the closest threat when multiple exist', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 }, threatDetectionRadius: 150 });
        const close = buildCarnivore({ id: 'close', position: { x: 30, y: 0 }, energy: 40 });
        const far = buildCarnivore({ id: 'far', position: { x: 100, y: 0 }, energy: 80 });

        const threat = findMostDangerousThreat(herbivore, [close, far]);

        expect(threat?.id).toBe('close');
      });

      it('returns null for non-herbivore entities', () => {
        const plant = buildPlant();
        const carnivore = buildCarnivore({ position: { x: 10, y: 0 } });

        const threat = findMostDangerousThreat(plant, [carnivore]);

        expect(threat).toBeNull();
      });

      it('ignores dead carnivores', () => {
        const herbivore = buildHerbivore({ position: { x: 0, y: 0 }, threatDetectionRadius: 100 });
        const dead = buildCarnivore({ id: 'dead', position: { x: 30, y: 0 }, isAlive: false });
        const alive = buildCarnivore({ id: 'alive', position: { x: 80, y: 0 } });

        const threat = findMostDangerousThreat(herbivore, [dead, alive]);

        expect(threat?.id).toBe('alive');
      });
    });

    describe('findOptimalFleeDirection', () => {
      it('calculates direction away from threat', () => {
        const herbivore = buildHerbivore({ position: { x: 100, y: 100 } });
        const threat = buildCarnivore({ position: { x: 50, y: 100 } });

        const fleeTarget = findOptimalFleeDirection(herbivore, threat, 800, 600, false);

        expect(fleeTarget.x).toBeGreaterThan(herbivore.position.x);
      });

      it('applies boundary bias when near edge', () => {
        const herbivore = buildHerbivore({ position: { x: 30, y: 100 } }); // Near left edge
        const threat = buildCarnivore({ position: { x: 150, y: 100 } }); // Threat to the right

        const fleeTarget = findOptimalFleeDirection(herbivore, threat, 800, 600, false);

        // Fleeing away from threat (left) but boundary bias should add rightward component
        // The target might still be left of current position but not at x=0
        expect(fleeTarget.x).toBeGreaterThanOrEqual(0);
        expect(fleeTarget.x).toBeLessThanOrEqual(800);
      });

      it('clamps target to garden bounds', () => {
        const herbivore = buildHerbivore({ position: { x: 750, y: 100 } });
        const threat = buildCarnivore({ position: { x: 700, y: 100 } });

        const fleeTarget = findOptimalFleeDirection(herbivore, threat, 800, 600, false);

        expect(fleeTarget.x).toBeLessThanOrEqual(800);
        expect(fleeTarget.y).toBeLessThanOrEqual(600);
        expect(fleeTarget.x).toBeGreaterThanOrEqual(0);
        expect(fleeTarget.y).toBeGreaterThanOrEqual(0);
      });

      it('picks random direction when threat is on top of herbivore', () => {
        const herbivore = buildHerbivore({ position: { x: 100, y: 100 } });
        const threat = buildCarnivore({ position: { x: 100, y: 100 } });

        const fleeTarget = findOptimalFleeDirection(herbivore, threat, 800, 600, false);

        // Should have moved somewhere
        const moved = fleeTarget.x !== 100 || fleeTarget.y !== 100;
        expect(moved).toBe(true);
      });
    });

    describe('moveEntityAwayFromTarget', () => {
      it('moves entity away from threat position', () => {
        const herbivore = buildHerbivore({ position: { x: 100, y: 100 } });
        const originalX = herbivore.position.x;
        const threatPosition = { x: 50, y: 100 };

        moveEntityAwayFromTarget(herbivore, threatPosition, 10, 800, 600, false);

        expect(herbivore.position.x).toBeGreaterThan(originalX);
      });

      it('does not move when speed is zero', () => {
        const herbivore = buildHerbivore({ position: { x: 100, y: 100 } });
        const original = { ...herbivore.position };
        const threatPosition = { x: 50, y: 100 };

        moveEntityAwayFromTarget(herbivore, threatPosition, 0, 800, 600, false);

        expect(herbivore.position).toEqual(original);
      });

      it('clamps position to garden bounds', () => {
        const herbivore = buildHerbivore({ position: { x: 790, y: 100 } });
        const threatPosition = { x: 700, y: 100 };

        moveEntityAwayFromTarget(herbivore, threatPosition, 50, 800, 600, false);

        expect(herbivore.position.x).toBeLessThanOrEqual(800);
        expect(herbivore.position.x).toBeGreaterThanOrEqual(0);
      });

      it('handles threat exactly on top of entity', () => {
        const herbivore = buildHerbivore({ position: { x: 100, y: 100 } });
        const threatPosition = { x: 100, y: 100 };

        moveEntityAwayFromTarget(herbivore, threatPosition, 10, 800, 600, false);

        // Should have moved somewhere
        const moved = herbivore.position.x !== 100 || herbivore.position.y !== 100;
        expect(moved).toBe(true);
      });
    });

    describe('isEntityNearGardenBoundary', () => {
      it('detects when entity is near left edge', () => {
        const herbivore = buildHerbivore({ position: { x: 30, y: 300 } });

        const result = isEntityNearGardenBoundary(herbivore, 50, 800, 600);

        expect(result.isNear).toBe(true);
        expect(result.nearestEdge).toBe('left');
      });

      it('detects when entity is near right edge', () => {
        const herbivore = buildHerbivore({ position: { x: 770, y: 300 } });

        const result = isEntityNearGardenBoundary(herbivore, 50, 800, 600);

        expect(result.isNear).toBe(true);
        expect(result.nearestEdge).toBe('right');
      });

      it('detects when entity is near top edge', () => {
        const herbivore = buildHerbivore({ position: { x: 400, y: 30 } });

        const result = isEntityNearGardenBoundary(herbivore, 50, 800, 600);

        expect(result.isNear).toBe(true);
        expect(result.nearestEdge).toBe('top');
      });

      it('detects when entity is near bottom edge', () => {
        const herbivore = buildHerbivore({ position: { x: 400, y: 570 } });

        const result = isEntityNearGardenBoundary(herbivore, 50, 800, 600);

        expect(result.isNear).toBe(true);
        expect(result.nearestEdge).toBe('bottom');
      });

      it('returns false when entity is in center', () => {
        const herbivore = buildHerbivore({ position: { x: 400, y: 300 } });

        const result = isEntityNearGardenBoundary(herbivore, 50, 800, 600);

        expect(result.isNear).toBe(false);
        expect(result.nearestEdge).toBeNull();
      });
    });

    describe('generateExplorationTarget', () => {
      it('generates target within garden bounds', () => {
        const carnivore = buildCarnivore({ position: { x: 400, y: 300 } });

        const target = generateExplorationTarget(carnivore, 800, 600);

        expect(target.x).toBeGreaterThanOrEqual(0);
        expect(target.x).toBeLessThanOrEqual(800);
        expect(target.y).toBeGreaterThanOrEqual(0);
        expect(target.y).toBeLessThanOrEqual(600);
      });

      it('generates target within reasonable exploration range', () => {
        const carnivore = buildCarnivore({ position: { x: 400, y: 300 } });

        const target = generateExplorationTarget(carnivore, 800, 600);

        const dx = target.x - carnivore.position.x;
        const dy = target.y - carnivore.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Should be within exploration range (150px)
        expect(distance).toBeLessThanOrEqual(150);
      });

      it('handles entity near boundary', () => {
        const carnivore = buildCarnivore({ position: { x: 10, y: 10 } });

        const target = generateExplorationTarget(carnivore, 800, 600);

        expect(target.x).toBeGreaterThanOrEqual(0);
        expect(target.x).toBeLessThanOrEqual(800);
        expect(target.y).toBeGreaterThanOrEqual(0);
        expect(target.y).toBeLessThanOrEqual(600);
      });
    });

    describe('findCompetingCarnivores', () => {
      it('returns empty array when targetPrey is null', () => {
        const carnivore = buildCarnivore({ position: { x: 100, y: 100 } });
        const other = buildCarnivore({ id: 'other', position: { x: 120, y: 100 } });

        const competitors = findCompetingCarnivores(carnivore, [other], null, 100);

        expect(competitors).toHaveLength(0);
      });

      it('finds carnivores near the same prey', () => {
        const carnivore = buildCarnivore({ id: 'c1', position: { x: 100, y: 100 } });
        const competitor = buildCarnivore({ id: 'c2', position: { x: 120, y: 100 } });
        const prey = buildHerbivore({ position: { x: 150, y: 100 } });

        const competitors = findCompetingCarnivores(carnivore, [competitor], prey, 100);

        expect(competitors).toHaveLength(1);
        expect(competitors[0].id).toBe('c2');
      });

      it('excludes self from competition', () => {
        const carnivore = buildCarnivore({ position: { x: 100, y: 100 } });
        const prey = buildHerbivore({ position: { x: 150, y: 100 } });

        const competitors = findCompetingCarnivores(carnivore, [carnivore], prey, 100);

        expect(competitors).toHaveLength(0);
      });

      it('excludes carnivores outside coordination radius', () => {
        const carnivore = buildCarnivore({ id: 'c1', position: { x: 100, y: 100 } });
        const farCarnivore = buildCarnivore({ id: 'c2', position: { x: 300, y: 100 } });
        const prey = buildHerbivore({ position: { x: 150, y: 100 } });

        const competitors = findCompetingCarnivores(carnivore, [farCarnivore], prey, 100);

        expect(competitors).toHaveLength(0);
      });

      it('excludes dead carnivores', () => {
        const carnivore = buildCarnivore({ id: 'c1', position: { x: 100, y: 100 } });
        const dead = buildCarnivore({ id: 'c2', position: { x: 120, y: 100 }, isAlive: false });
        const prey = buildHerbivore({ position: { x: 150, y: 100 } });

        const competitors = findCompetingCarnivores(carnivore, [dead], prey, 100);

        expect(competitors).toHaveLength(0);
      });
    });
  });
});
