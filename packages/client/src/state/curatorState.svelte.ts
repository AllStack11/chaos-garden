/**
 * Chaos Garden - Curator Tools State (Svelte 5 Runes)
 *
 * Manages active curator brush tool, world cursor coordinates, and camera mode.
 */

export type CuratorTool =
  | 'INSPECT'
  | 'WATER'
  | 'NUTRIENTS'
  | 'SPAWN_PLANT'
  | 'SPAWN_HERBIVORE'
  | 'SPAWN_CARNIVORE'
  | 'SPAWN_FUNGUS';

export class CuratorState {
  activeTool = $state<CuratorTool>('INSPECT');
  brushRadius = $state<number>(32); // World coordinate radius
  brushIntensity = $state<number>(0.5);
  isFollowCamActive = $state<boolean>(false);
  cursorWorldPos = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  isChronicleOpen = $state<boolean>(false);
  isDiagnosticsOpen = $state<boolean>(false);

  setTool(tool: CuratorTool): void {
    this.activeTool = tool;
  }

  toggleChronicle(): void {
    this.isChronicleOpen = !this.isChronicleOpen;
  }

  toggleDiagnostics(): void {
    this.isDiagnosticsOpen = !this.isDiagnosticsOpen;
  }
}

export const curatorState = new CuratorState();

