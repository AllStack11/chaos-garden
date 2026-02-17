import type { SimulationEventType, WeatherStateName } from '@chaos-garden/shared';
import type {
  DerivedSoundscapeState,
  SoundscapeEventAccent,
  SoundscapeInput,
  SoundscapeLayerTargets,
} from './types';

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
  setTargetAtTime(value: number, startTime: number, timeConstant: number): void;
}

export interface SoundscapeEngine {
  setMasterVolume(volume: number): void;
  setMuted(muted: boolean): void;
  applyState(state: DerivedSoundscapeState): void;
  triggerAccents(accents: SoundscapeEventAccent[]): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): void;
}

const DEFAULT_WEATHER: WeatherStateName = 'CLEAR';
const MAX_EVENTS_CONSIDERED = 16;
const EVENT_TYPES_FOR_ACCENTS: Set<SimulationEventType> = new Set([
  'BIRTH',
  'DEATH',
  'MUTATION',
  'EXTINCTION',
  'POPULATION_EXPLOSION',
  'ECOSYSTEM_COLLAPSE',
]);

function isAccentEventType(eventType: SimulationEventType): eventType is SoundscapeEventAccent['type'] {
  return EVENT_TYPES_FOR_ACCENTS.has(eventType);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return clamp(numerator / denominator, 0, 1);
}

function weatherMultiplier(weather: WeatherStateName, map: Record<WeatherStateName, number>): number {
  return map[weather] ?? map.CLEAR;
}

export function deriveSoundscapeState(input: SoundscapeInput): DerivedSoundscapeState {
  const state = input.gardenState;
  const weather = state?.environment.weatherState?.currentState ?? DEFAULT_WEATHER;
  const sunlight = clamp(state?.environment.sunlight ?? 0.5, 0, 1);
  const dayNightBlend = sunlight;

  const populations = state?.populationSummary;
  const totalLiving = populations?.totalLiving ?? 0;
  const plants = populations?.plants ?? 0;
  const fungi = populations?.fungi ?? 0;
  const herbivores = populations?.herbivores ?? 0;
  const carnivores = populations?.carnivores ?? 0;

  const biodiversity = normalizeRatio(
    [plants, fungi, herbivores, carnivores].filter((count) => count > 0).length,
    4,
  );

  const predatorShare = normalizeRatio(carnivores, totalLiving);
  const preyPressure = herbivores > 0 ? clamp(carnivores / herbivores, 0, 2) / 2 : predatorShare;
  const populationTension = clamp(predatorShare * 0.55 + preyPressure * 0.45, 0, 1);

  const recentEvents = input.recentEvents.slice(-MAX_EVENTS_CONSIDERED);
  const weightedEvents = recentEvents.reduce((sum, event, index) => {
    const recencyWeight = (index + 1) / recentEvents.length;
    const severityWeight = event.severity === 'CRITICAL'
      ? 1
      : event.severity === 'HIGH'
        ? 0.8
        : event.severity === 'MEDIUM'
          ? 0.55
          : 0.35;
    return sum + recencyWeight * severityWeight;
  }, 0);
  const normalizationBase = Math.max(1, recentEvents.length * 0.65);
  const eventIntensity = clamp(weightedEvents / normalizationBase, 0, 1);

  const weatherWindBoost = weatherMultiplier(weather, {
    CLEAR: 0.22,
    OVERCAST: 0.48,
    RAIN: 0.72,
    STORM: 0.98,
    DROUGHT: 0.34,
    FOG: 0.3,
  });

  const weatherBrightness = weatherMultiplier(weather, {
    CLEAR: 1,
    OVERCAST: 0.75,
    RAIN: 0.62,
    STORM: 0.45,
    DROUGHT: 0.85,
    FOG: 0.7,
  });

  const weatherBiophony = weatherMultiplier(weather, {
    CLEAR: 0.78,
    OVERCAST: 0.64,
    RAIN: 0.55,
    STORM: 0.42,
    DROUGHT: 0.36,
    FOG: 0.5,
  });

  const weatherRumble = weatherMultiplier(weather, {
    CLEAR: 0.18,
    OVERCAST: 0.34,
    RAIN: 0.48,
    STORM: 0.82,
    DROUGHT: 0.52,
    FOG: 0.3,
  });

  const layerTargets: SoundscapeLayerTargets = {
    windLevel: clamp(0.007 + weatherWindBoost * 0.055 + eventIntensity * 0.007, 0.003, 0.095),
    windFilterHz: clamp(480 + weatherBrightness * 820 + (1 - dayNightBlend) * 130, 380, 1450),
    droneLevel: clamp(0.075 + (1 - populationTension) * 0.04 + (1 - weatherWindBoost) * 0.016, 0.055, 0.17),
    droneFilterHz: clamp(480 + dayNightBlend * 760 * weatherBrightness, 360, 1350),
    droneFrequencyHz: clamp(74 + dayNightBlend * 18 + (weatherBrightness - 0.5) * 4, 66, 98),
    biophonyLevel: clamp(0.011 + biodiversity * 0.04 * weatherBiophony + (1 - populationTension) * 0.008, 0.004, 0.075),
    biophonyPulseRateHz: clamp(0.055 + dayNightBlend * 0.11 + populationTension * 0.05, 0.05, 0.26),
    tensionLevel: clamp(0.005 + populationTension * 0.055 + weatherRumble * 0.02 + eventIntensity * 0.02, 0.003, 0.095),
    tensionFilterHz: clamp(75 + populationTension * 80 + weatherRumble * 38, 55, 220),
  };

  return {
    weather,
    sunlight,
    dayNightBlend,
    populationTension,
    biodiversity,
    eventIntensity,
    layerTargets,
  };
}

export function deriveEventAccents(input: SoundscapeInput): SoundscapeEventAccent[] {
  const events = input.recentEvents.slice(-MAX_EVENTS_CONSIDERED);
  const accents: SoundscapeEventAccent[] = [];

  for (const event of events) {
    if (!isAccentEventType(event.eventType)) {
      continue;
    }

    const severityWeight = event.severity === 'CRITICAL'
      ? 1
      : event.severity === 'HIGH'
        ? 0.78
        : event.severity === 'MEDIUM'
          ? 0.58
          : 0.4;

    accents.push({
      type: event.eventType,
      intensity: clamp(severityWeight, 0.2, 1),
    });
  }

  return accents;
}

export function scheduleSmoothedValue(
  param: AudioParamLike,
  nextValue: number,
  startTime: number,
  rampSeconds: number,
): void {
  const boundedRamp = clamp(rampSeconds, 0.01, 2);
  const boundedValue = Number.isFinite(nextValue) ? nextValue : 0;
  param.setValueAtTime(param.value, startTime);
  param.linearRampToValueAtTime(boundedValue, startTime + boundedRamp);
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const durationSeconds = 2;
  const frameCount = context.sampleRate * durationSeconds;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channelData = buffer.getChannelData(0);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    channelData[index] = pink * 0.1;
  }

  return buffer;
}

function createLoopedNoiseNode(context: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
}

export class WebAudioSoundscapeEngine implements SoundscapeEngine {
  private readonly context: AudioContext;
  private readonly masterGain: GainNode;
  private readonly masterToneFilter: BiquadFilterNode;
  private readonly compressor: DynamicsCompressorNode;

  private readonly windGain: GainNode;
  private readonly windFilter: BiquadFilterNode;

  private readonly droneGain: GainNode;
  private readonly droneFilter: BiquadFilterNode;
  private readonly droneOscA: OscillatorNode;
  private readonly droneOscB: OscillatorNode;

  private readonly biophonyGain: GainNode;
  private readonly biophonyPulseGain: GainNode;
  private readonly biophonyPulseOsc: OscillatorNode;
  private biophonyLfo: number | null = null;
  private droneWowTimer: number | null = null;
  private windDriftTimer: number | null = null;
  private wowPhase = 0;
  private windPhase = 0;
  private targetDroneFrequencyHz = 86;
  private targetWindLevel = 0.01;

  private readonly tensionGain: GainNode;
  private readonly tensionFilter: BiquadFilterNode;
  private readonly tensionOsc: OscillatorNode;

  private readonly noiseBuffer: AudioBuffer;
  private readonly windSource: AudioBufferSourceNode;
  private readonly tensionNoiseSource: AudioBufferSourceNode;

  private muted = true;
  private masterVolume = 0.55;

  constructor(context: AudioContext) {
    this.context = context;

    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0;
    this.masterToneFilter = context.createBiquadFilter();
    this.masterToneFilter.type = 'lowpass';
    this.masterToneFilter.frequency.value = 2400;
    this.masterToneFilter.Q.value = 0.52;

    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -26;
    this.compressor.knee.value = 32;
    this.compressor.ratio.value = 2;
    this.compressor.attack.value = 0.03;
    this.compressor.release.value = 0.4;

    this.masterGain.connect(this.masterToneFilter);
    this.masterToneFilter.connect(this.compressor);
    this.compressor.connect(context.destination);

    this.noiseBuffer = createNoiseBuffer(context);

    this.windSource = createLoopedNoiseNode(context, this.noiseBuffer);
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 900;
    this.windFilter.Q.value = 0.18;
    this.windGain = context.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    this.droneOscA = context.createOscillator();
    this.droneOscA.type = 'sine';
    this.droneOscA.frequency.value = 82;
    this.droneOscB = context.createOscillator();
    this.droneOscB.type = 'triangle';
    this.droneOscB.frequency.value = 123;
    this.droneFilter = context.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 900;
    this.droneGain = context.createGain();
    this.droneGain.gain.value = 0;
    this.droneOscA.connect(this.droneFilter);
    this.droneOscB.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    this.droneOscA.start();
    this.droneOscB.start();

    this.biophonyPulseOsc = context.createOscillator();
    this.biophonyPulseOsc.type = 'sine';
    this.biophonyPulseOsc.frequency.value = 160;
    this.biophonyPulseGain = context.createGain();
    this.biophonyPulseGain.gain.value = 0;
    this.biophonyGain = context.createGain();
    this.biophonyGain.gain.value = 0;
    this.biophonyPulseOsc.connect(this.biophonyPulseGain);
    this.biophonyPulseGain.connect(this.biophonyGain);
    this.biophonyGain.connect(this.masterGain);
    this.biophonyPulseOsc.start();

    this.tensionNoiseSource = createLoopedNoiseNode(context, this.noiseBuffer);
    this.tensionFilter = context.createBiquadFilter();
    this.tensionFilter.type = 'lowpass';
    this.tensionFilter.frequency.value = 110;
    this.tensionGain = context.createGain();
    this.tensionGain.gain.value = 0;
    this.tensionOsc = context.createOscillator();
    this.tensionOsc.type = 'sine';
    this.tensionOsc.frequency.value = 32;
    this.tensionNoiseSource.connect(this.tensionFilter);
    this.tensionOsc.connect(this.tensionFilter);
    this.tensionFilter.connect(this.tensionGain);
    this.tensionGain.connect(this.masterGain);
    this.tensionOsc.start();

    this.scheduleDroneWow();
    this.scheduleWindDrift();
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = clamp(volume, 0, 1);
    this.applyMasterOutput();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterOutput();
  }

  private applyMasterOutput(): void {
    const target = this.muted ? 0 : this.masterVolume;
    const now = this.context.currentTime;
    scheduleSmoothedValue(this.masterGain.gain, target, now, 0.15);
  }

  applyState(state: DerivedSoundscapeState): void {
    const now = this.context.currentTime;
    const targets = state.layerTargets;

    this.targetWindLevel = targets.windLevel;
    scheduleSmoothedValue(this.windGain.gain, targets.windLevel, now, 0.42);
    scheduleSmoothedValue(this.windFilter.frequency, targets.windFilterHz, now, 0.5);
    scheduleSmoothedValue(this.masterToneFilter.frequency, 1700 + state.dayNightBlend * 620, now, 0.6);

    scheduleSmoothedValue(this.droneGain.gain, targets.droneLevel, now, 0.44);
    scheduleSmoothedValue(this.droneFilter.frequency, targets.droneFilterHz, now, 0.44);
    this.targetDroneFrequencyHz = targets.droneFrequencyHz;
    scheduleSmoothedValue(this.droneOscA.frequency, targets.droneFrequencyHz, now, 0.46);
    scheduleSmoothedValue(this.droneOscB.frequency, targets.droneFrequencyHz * 1.498, now, 0.46);

    scheduleSmoothedValue(this.biophonyGain.gain, targets.biophonyLevel, now, 0.4);
    scheduleSmoothedValue(this.biophonyPulseOsc.frequency, 110 + targets.biophonyPulseRateHz * 140, now, 0.4);

    scheduleSmoothedValue(this.tensionGain.gain, targets.tensionLevel, now, 0.32);
    scheduleSmoothedValue(this.tensionFilter.frequency, targets.tensionFilterHz, now, 0.35);
    scheduleSmoothedValue(this.tensionOsc.frequency, 24 + state.populationTension * 14, now, 0.4);

    this.scheduleBiophonyPulse(targets.biophonyPulseRateHz, targets.biophonyLevel);
  }

  private scheduleBiophonyPulse(pulseRateHz: number, level: number): void {
    if (this.biophonyLfo) {
      window.clearTimeout(this.biophonyLfo);
      this.biophonyLfo = null;
    }

    const pulseIntervalMs = clamp(1000 / Math.max(0.05, pulseRateHz), 400, 5000);
    const now = this.context.currentTime;
    const pulsePeak = clamp(level * 1.35, 0, 0.085);

    this.biophonyPulseGain.gain.cancelScheduledValues(now);
    this.biophonyPulseGain.gain.setValueAtTime(0.0001, now);
    this.biophonyPulseGain.gain.linearRampToValueAtTime(pulsePeak, now + 0.15);
    this.biophonyPulseGain.gain.setTargetAtTime(0.0001, now + 0.2, 0.42);

    this.biophonyLfo = window.setTimeout(() => {
      this.scheduleBiophonyPulse(pulseRateHz, level);
    }, pulseIntervalMs);
  }

  triggerAccents(accents: SoundscapeEventAccent[]): void {
    if (accents.length === 0) {
      return;
    }

    const now = this.context.currentTime;
    const limitedAccents = accents.slice(-4);

    limitedAccents.forEach((accent, index) => {
      const offset = now + index * 0.08;
      const amplitude = clamp(0.004 + accent.intensity * 0.012, 0.003, 0.016);
      const baseFrequency = accent.type === 'BIRTH'
        ? 300
        : accent.type === 'DEATH'
          ? 156
          : accent.type === 'MUTATION'
            ? 246
            : accent.type === 'EXTINCTION'
              ? 110
              : accent.type === 'POPULATION_EXPLOSION'
                ? 220
                : 132;

      const tone = this.context.createOscillator();
      tone.type = accent.type === 'MUTATION' ? 'triangle' : 'sine';
      tone.frequency.value = baseFrequency;

      const toneFilter = this.context.createBiquadFilter();
      toneFilter.type = 'lowpass';
      toneFilter.frequency.value = 900;
      toneFilter.Q.value = 0.5;

      const gain = this.context.createGain();
      gain.gain.value = 0;

      tone.connect(toneFilter);
      toneFilter.connect(gain);
      gain.connect(this.masterGain);

      tone.start(offset);
      gain.gain.setValueAtTime(0, offset);
      gain.gain.linearRampToValueAtTime(amplitude, offset + 0.1);
      gain.gain.setTargetAtTime(0.0001, offset + 0.12, 0.34);

      tone.frequency.setTargetAtTime(baseFrequency * 0.9, offset + 0.07, 0.34);
      tone.stop(offset + 0.62);

      window.setTimeout(() => {
        tone.disconnect();
        toneFilter.disconnect();
        gain.disconnect();
      }, 780);
    });
  }

  private scheduleDroneWow(): void {
    if (this.droneWowTimer) {
      window.clearTimeout(this.droneWowTimer);
      this.droneWowTimer = null;
    }

    this.wowPhase += 0.23;
    const wowCents = Math.sin(this.wowPhase) * 4 + Math.sin(this.wowPhase * 0.6) * 1.8;
    const ratio = Math.pow(2, wowCents / 1200);
    const now = this.context.currentTime;
    scheduleSmoothedValue(this.droneOscA.frequency, this.targetDroneFrequencyHz * ratio, now, 0.22);
    scheduleSmoothedValue(this.droneOscB.frequency, this.targetDroneFrequencyHz * 1.498 * ratio, now, 0.22);

    this.droneWowTimer = window.setTimeout(() => {
      this.scheduleDroneWow();
    }, 260);
  }

  private scheduleWindDrift(): void {
    if (this.windDriftTimer) {
      window.clearTimeout(this.windDriftTimer);
      this.windDriftTimer = null;
    }

    this.windPhase += 0.31;
    const drift = 0.88 + (Math.sin(this.windPhase) * 0.06 + Math.sin(this.windPhase * 0.43) * 0.04);
    const now = this.context.currentTime;
    scheduleSmoothedValue(this.windGain.gain, clamp(this.targetWindLevel * drift, 0.002, 0.12), now, 0.3);

    this.windDriftTimer = window.setTimeout(() => {
      this.scheduleWindDrift();
    }, 340);
  }

  async suspend(): Promise<void> {
    if (this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  dispose(): void {
    if (this.biophonyLfo) {
      window.clearTimeout(this.biophonyLfo);
      this.biophonyLfo = null;
    }
    if (this.droneWowTimer) {
      window.clearTimeout(this.droneWowTimer);
      this.droneWowTimer = null;
    }
    if (this.windDriftTimer) {
      window.clearTimeout(this.windDriftTimer);
      this.windDriftTimer = null;
    }
    this.windSource.stop();
    this.tensionNoiseSource.stop();
    this.droneOscA.stop();
    this.droneOscB.stop();
    this.biophonyPulseOsc.stop();
    this.tensionOsc.stop();

    void this.context.close();
  }
}

export function createWebAudioSoundscapeEngine(): SoundscapeEngine | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  const context = new AudioContextCtor();
  return new WebAudioSoundscapeEngine(context);
}
