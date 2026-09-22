import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import StatsHUD from '../../src/ui/components/StatsHUD.svelte';
import EntityInspector from '../../src/ui/components/EntityInspector.svelte';
import { gardenState } from '../../src/state/gardenState.svelte.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('UI Components Telemetry Reactivity Tests', () => {
  it('updates StatsHUD rendered output when telemetry pulse updates gardenState', () => {
    // Initial state
    gardenState.updateFromTelemetry({
      type: 'TELEMETRY_PULSE',
      tick: 10,
      tps: 60,
      populations: {
        plants: 10,
        herbivores: 5,
        carnivores: 2,
        fungi: 3,
        totalLiving: 20,
        totalBiomass: 150,
      },
    });

    const initial = render(StatsHUD);
    expect(initial.body).toContain('Tick 10');
    expect(initial.body).toContain('P: 10');
    expect(initial.body).toContain('H: 5');

    // Simulate new incoming telemetry pulse
    gardenState.updateFromTelemetry({
      type: 'TELEMETRY_PULSE',
      tick: 450,
      tps: 58,
      populations: {
        plants: 150,
        herbivores: 40,
        carnivores: 15,
        fungi: 25,
        totalLiving: 230,
        totalBiomass: 12500,
      },
    });

    const updated = render(StatsHUD);
    expect(updated.body).toContain('Tick 450');
    expect(updated.body).toContain('58 TPS');
    expect(updated.body).toContain('230');
    expect(updated.body).toContain('12500');
    expect(updated.body).toContain('P: 150');
    expect(updated.body).toContain('H: 40');
    expect(updated.body).toContain('C: 15');
    expect(updated.body).toContain('F: 25');
  });

  it('updates EntityInspector rendered output when selected entity vitals change in telemetry', () => {
    // Deselected state: inspector should render nothing
    gardenState.selectedEntity = null;
    const emptyRender = render(EntityInspector, {
      props: {
        onFollow: () => {},
        onFeed: () => {},
        onCull: () => {},
        onClose: () => {},
      },
    });
    expect(emptyRender.body).not.toContain('Amoebic Boid');
    expect(emptyRender.body).not.toContain('Chromosomes');

    // Telemetry pulse provides selected organism vitals
    gardenState.updateFromTelemetry({
      type: 'TELEMETRY_PULSE',
      tick: 500,
      tps: 60,
      populations: {
        plants: 100,
        herbivores: 30,
        carnivores: 10,
        fungi: 20,
        totalLiving: 160,
        totalBiomass: 8000,
      },
      selectedEntityVitals: {
        entityId: 9876,
        parentEntityId: 1234,
        idHash: 0xabcdef,
        name: 'Amoebic Boid #9876',
        species: 'Herbivore',
        age: 120,
        maxLifespan: 1800,
        energy: 78.5,
        health: 95.0,
        generation: 3,
        type: EntityTypeCode.HERBIVORE,
        pigment: 210,
        speed: 18.2,
        maxSpeed: 22.0,
        perceptionRadius: 60,
        reproductionThreshold: 65,
        metabolismRate: 0.08,
        x: 450,
        y: 620,
      },
    });

    const renderedInspector = render(EntityInspector, {
      props: {
        onFollow: () => {},
        onFeed: () => {},
        onCull: () => {},
        onClose: () => {},
      },
    });

    expect(renderedInspector.body).toContain('Amoebic Boid #9876');
    expect(renderedInspector.body).toContain('#9876');
    expect(renderedInspector.body).toContain('#1234');
    expect(renderedInspector.body).toContain('Gen 3');
    expect(renderedInspector.body).toContain('Herbivore');
  });
});
