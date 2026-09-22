import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import StatsHUD from '../../src/ui/components/StatsHUD.svelte';
import EntityInspector from '../../src/ui/components/EntityInspector.svelte';
import { gardenState } from '../../src/state/gardenState.svelte.js';
import { EntityTypeCode } from '@chaos-garden/shared';

describe('UI Components Live Mounted Reactivity Tests (happy-dom)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('updates an already-mounted StatsHUD component when a telemetry pulse arrives', () => {
    gardenState.tick = 10;
    gardenState.tps = 60;
    gardenState.populations = {
      plants: 10,
      herbivores: 5,
      carnivores: 2,
      fungi: 3,
      totalLiving: 20,
      totalBiomass: 150,
    };

    const component = mount(StatsHUD, { target: container });

    expect(container.textContent).toContain('Tick 10');
    expect(container.textContent).toContain('P: 10');
    expect(container.textContent).toContain('H: 5');

    // Simulate telemetry pulse and flush reactive DOM updates
    flushSync(() => {
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
    });

    // Verify the live DOM updated in-place without remounting
    expect(container.textContent).toContain('Tick 450');
    expect(container.textContent).toContain('58 TPS');
    expect(container.textContent).toContain('230');
    expect(container.textContent).toContain('12500');
    expect(container.textContent).toContain('P: 150');
    expect(container.textContent).toContain('H: 40');
    expect(container.textContent).toContain('C: 15');
    expect(container.textContent).toContain('F: 25');

    unmount(component);
  });

  it('updates an already-mounted EntityInspector when selected entity vitals change in telemetry', () => {
    gardenState.selectedEntity = null;

    const component = mount(EntityInspector, {
      target: container,
      props: {
        onFollow: () => {},
        onFeed: () => {},
        onCull: () => {},
        onClose: () => {},
      },
    });

    // Inspector is closed when selectedEntity is null
    expect(container.textContent).not.toContain('Amoebic Boid');

    // Telemetry pulse updates selected entity
    flushSync(() => {
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
    });

    // Verify live DOM now renders the entity vitals
    expect(container.textContent).toContain('Amoebic Boid #9876');
    expect(container.textContent).toContain('#9876');
    expect(container.textContent).toContain('#1234');
    expect(container.textContent).toContain('Gen 3');
    expect(container.textContent).toContain('Herbivore');

    // Deselect entity and verify it closes
    flushSync(() => {
      gardenState.selectedEntity = null;
    });

    expect(container.textContent).not.toContain('Amoebic Boid');

    unmount(component);
  });
});
