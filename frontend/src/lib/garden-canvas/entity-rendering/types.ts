import type { Entity } from '../../../env.d.ts';

export interface EntityColor {
  h: number;
  s: number;
  l: number;
}

export interface EntityRenderConfig {
  selectedEntity: Entity | null;
  hoveredEntity: Entity | null;
  worldToScreen: (x: number, y: number) => { x: number; y: number; scale: number };
  calculateEntitySize: (energy: number) => number;
  colors: Record<'plant' | 'herbivore' | 'carnivore' | 'fungus', EntityColor>;
}
