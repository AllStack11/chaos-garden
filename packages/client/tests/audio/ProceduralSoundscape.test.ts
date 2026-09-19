import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProceduralSoundscape } from '../../src/audio/ProceduralSoundscape.js';

class MockAudioParam {
  value: number = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn((val: number) => {
    this.value = val;
  });
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  type = 'lowpass';
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
  attack = new MockAudioParam();
  release = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  frequency = new MockAudioParam();
  detune = new MockAudioParam();
  type = 'sine';
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime: number = 0;
  sampleRate: number = 44100;
  destination = new MockAudioNode();

  createGain = vi.fn(() => new MockGainNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createDynamicsCompressor = vi.fn(() => new MockDynamicsCompressorNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBuffer = vi.fn((channels, length, sampleRate) => ({
    getChannelData: () => new Float32Array(length),
  }));
  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
    loop: false,
  }));
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

describe('ProceduralSoundscape Unit Tests', () => {
  beforeEach(() => {
    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).window = {
      AudioContext: MockAudioContext,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  it('initializes in suspended state with safety compressor and submix buses', () => {
    const soundscape = new ProceduralSoundscape();
    expect(soundscape.state).toBe('suspended');
    expect(soundscape.ambientBus).toBeDefined();
    expect(soundscape.weatherBus).toBeDefined();
    expect(soundscape.musicBus).toBeDefined();
    expect(soundscape.sfxBus).toBeDefined();
  });

  it('unlocks AudioContext and starts procedural generators', async () => {
    const soundscape = new ProceduralSoundscape();
    await soundscape.unlock();
    expect(soundscape.state).toBe('running');
  });

  it('adjusts master volume with parameter clamping', () => {
    const soundscape = new ProceduralSoundscape();

    soundscape.setMasterVolume(0.85);
    expect(soundscape.volume).toBe(0.85);

    soundscape.setMasterVolume(1.5); // Should clamp to 1.0
    expect(soundscape.volume).toBe(1.0);

    soundscape.setMasterVolume(-0.2); // Should clamp to 0.0
    expect(soundscape.volume).toBe(0.0);
  });

  it('toggles mute state and restores volume on unmute', () => {
    const soundscape = new ProceduralSoundscape();
    soundscape.setMasterVolume(0.6);

    soundscape.setMuted(true);
    expect(soundscape.muted).toBe(true);

    soundscape.setMuted(false);
    expect(soundscape.muted).toBe(false);
    expect(soundscape.volume).toBe(0.6);
  });

  it('supports suspend and resume for background power throttling', async () => {
    const soundscape = new ProceduralSoundscape();
    await soundscape.unlock();

    await soundscape.suspend();
    expect(soundscape.state).toBe('suspended');

    await soundscape.resume();
    expect(soundscape.state).toBe('running');
  });
});

