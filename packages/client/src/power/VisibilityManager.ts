/**
 * Chaos Garden - Battery & Thermal Visibility Manager
 *
 * Integrates with the Page Visibility API to throttle CPU/GPU consumption to < 1%
 * when the terrarium runs in background browser tabs.
 */

import type { WorkerBridge } from '../worker/WorkerBridge.js';
import type { GardenViewport } from '../renderer/GardenViewport.js';
import type { ProceduralSoundscape } from '../audio/ProceduralSoundscape.js';
import { curatorSession } from '../storage/CuratorSession.js';

export interface VisibilityManagerOptions {
  bridge: WorkerBridge;
  viewport?: GardenViewport | null;
  audio: ProceduralSoundscape;
  backgroundTps?: number;
  foregroundTps?: number;
}

export class VisibilityManager {
  private bridge: WorkerBridge;
  private viewport: GardenViewport | null = null;
  private audio: ProceduralSoundscape;

  readonly backgroundTps: number;
  readonly foregroundTps: number;

  private isBackground = false;
  private visibilityHandler: (() => void) | null = null;

  constructor(options: VisibilityManagerOptions) {
    this.bridge = options.bridge;
    this.viewport = options.viewport ?? null;
    this.audio = options.audio;
    this.backgroundTps = options.backgroundTps ?? 5;
    this.foregroundTps = options.foregroundTps ?? 60;

    this.setupListeners();
  }

  setViewport(viewport: GardenViewport): void {
    this.viewport = viewport;
  }

  private setupListeners(): void {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.onEnterBackground();
      } else {
        this.onEnterForeground();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  onEnterBackground(): void {
    if (this.isBackground) return;
    this.isBackground = true;

    // 1. Throttle Web Worker to 5 TPS
    this.bridge.setThrottle(this.backgroundTps);

    // 2. Stop PixiJS rendering ticker (drops GPU draw calls to 0)
    this.viewport?.stopTicker();

    // 3. Suspend Web Audio synthesis
    this.audio.suspend();

    // 4. Suspend curator lease renewal attempts
    curatorSession.setPageVisibility(true);
  }

  onEnterForeground(): void {
    if (!this.isBackground) return;
    this.isBackground = false;

    // 1. Restore Web Worker to 60 TPS
    // 1. Restore Web Worker to target TPS
    this.bridge.setThrottle(this.foregroundTps);

    // 2. Restart PixiJS rendering ticker
    this.viewport?.startTicker();

    // 3. Resume Web Audio synthesis
    this.audio.resume();

    // 4. Resume curator lease renewal attempts
    curatorSession.setPageVisibility(false);
  }

  get isThrottled(): boolean {
    return this.isBackground;
  }

  destroy(): void {
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}
