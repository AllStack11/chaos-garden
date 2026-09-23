import { describe, it, expect, beforeEach } from 'vitest';
import { CuratorState, curatorState } from '../../src/state/curatorState.svelte.js';

describe('CuratorState Unit Tests', () => {
  let state: CuratorState;

  beforeEach(() => {
    state = new CuratorState();
  });

  it('initializes with default values', () => {
    expect(state.activeTool).toBe('INSPECT');
    expect(state.brushRadius).toBe(32);
    expect(state.brushIntensity).toBe(0.5);
    expect(state.isFollowCamActive).toBe(false);
    expect(state.cursorWorldPos).toEqual({ x: 0, y: 0 });
    expect(state.isChronicleOpen).toBe(false);
    expect(state.isDiagnosticsOpen).toBe(false);
  });

  it('updates tool with setTool', () => {
    state.setTool('WATER');
    expect(state.activeTool).toBe('WATER');

    state.setTool('SPAWN_CARNIVORE');
    expect(state.activeTool).toBe('SPAWN_CARNIVORE');

    state.setTool('NUTRIENTS');
    expect(state.activeTool).toBe('NUTRIENTS');
  });

  it('toggles chronicle drawer', () => {
    expect(state.isChronicleOpen).toBe(false);
    state.toggleChronicle();
    expect(state.isChronicleOpen).toBe(true);
    state.toggleChronicle();
    expect(state.isChronicleOpen).toBe(false);
  });

  it('toggles diagnostics modal', () => {
    expect(state.isDiagnosticsOpen).toBe(false);
    state.toggleDiagnostics();
    expect(state.isDiagnosticsOpen).toBe(true);
    state.toggleDiagnostics();
    expect(state.isDiagnosticsOpen).toBe(false);
  });

  it('updates cursor world position', () => {
    state.cursorWorldPos = { x: 500, y: 350 };
    expect(state.cursorWorldPos).toEqual({ x: 500, y: 350 });
  });

  it('singleton export is available and mutable', () => {
    expect(curatorState).toBeDefined();
    curatorState.setTool('SPAWN_PLANT');
    expect(curatorState.activeTool).toBe('SPAWN_PLANT');
    curatorState.setTool('INSPECT');
  });
});

