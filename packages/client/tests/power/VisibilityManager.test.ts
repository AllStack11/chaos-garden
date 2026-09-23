import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VisibilityManager } from '../../src/power/VisibilityManager.js';

describe('VisibilityManager Unit Tests', () => {
  let mockBridge: any;
  let mockViewport: any;
  let mockAudio: any;

  beforeEach(() => {
    (globalThis as any).document = {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    mockBridge = {
      setThrottle: vi.fn(),
    };
    mockViewport = {
      stopTicker: vi.fn(),
      startTicker: vi.fn(),
    };
    mockAudio = {
      suspend: vi.fn(),
      resume: vi.fn(),
    };
  });

  it('slows the observer clock, stops ticker and suspends audio on tab background', () => {
    const manager = new VisibilityManager({
      bridge: mockBridge,
      viewport: mockViewport,
      audio: mockAudio,
    });

    manager.onEnterBackground();

    expect(manager.isThrottled).toBe(true);
    expect(mockBridge.setThrottle).toHaveBeenCalledWith(1 / 30);
    expect(mockViewport.stopTicker).toHaveBeenCalled();
    expect(mockAudio.suspend).toHaveBeenCalled();
  });

  it('restores the normal observer clock, ticker and audio on tab foreground', () => {
    const manager = new VisibilityManager({
      bridge: mockBridge,
      viewport: mockViewport,
      audio: mockAudio,
    });

    manager.onEnterBackground();
    manager.onEnterForeground();

    expect(manager.isThrottled).toBe(false);
    expect(mockBridge.setThrottle).toHaveBeenCalledWith(1 / 3);
    expect(mockViewport.startTicker).toHaveBeenCalled();
    expect(mockAudio.resume).toHaveBeenCalled();
  });

  it('ignores duplicate background/foreground calls (idempotent)', () => {
    const manager = new VisibilityManager({
      bridge: mockBridge,
      viewport: mockViewport,
      audio: mockAudio,
    });

    manager.onEnterBackground();
    manager.onEnterBackground();

    expect(mockBridge.setThrottle).toHaveBeenCalledTimes(1);
    expect(mockViewport.stopTicker).toHaveBeenCalledTimes(1);
  });
});
