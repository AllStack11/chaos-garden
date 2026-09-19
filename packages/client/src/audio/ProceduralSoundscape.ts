/**
 * Chaos Garden - Master Procedural Soundscape Manager
 *
 * Coordinates 100% procedural Web Audio synthesis across all audio buses.
 * Starts in suspended state, unlocks on first user interaction, and protects output
 * with a master DynamicsCompressorNode limiter.
 */

import { AmbientDrone } from './AmbientDrone.js';
import { WeatherNoise } from './WeatherNoise.js';
import { TrophicHarmonizer } from './TrophicHarmonizer.js';
import { SoundEffects } from './SoundEffects.js';

export class ProceduralSoundscape {
  readonly ctx: AudioContext;

  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;

  readonly ambientBus: GainNode;
  readonly weatherBus: GainNode;
  readonly musicBus: GainNode;
  readonly sfxBus: GainNode;

  readonly drone: AmbientDrone;
  readonly weather: WeatherNoise;
  readonly harmonizer: TrophicHarmonizer;
  readonly sfx: SoundEffects;

  private isMuted = false;
  private userVolume = 0.7;
  private isUnlocked = false;

  constructor() {
    // Web Audio Context starts suspended
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtx();

    // Master Safety Limiter
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.userVolume;

    // Submix buses
    this.ambientBus = this.ctx.createGain();
    this.weatherBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();

    // Routing: Submixes -> MasterGain -> Compressor -> Destination
    this.ambientBus.connect(this.masterGain);
    this.weatherBus.connect(this.masterGain);
    this.musicBus.connect(this.masterGain);
    this.sfxBus.connect(this.masterGain);
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Subsystem synthesizers
    this.drone = new AmbientDrone(this.ctx, this.ambientBus);
    this.weather = new WeatherNoise(this.ctx, this.weatherBus);
    this.harmonizer = new TrophicHarmonizer(this.ctx, this.musicBus);
    this.sfx = new SoundEffects(this.ctx, this.sfxBus);

    this.setupUnlockListener();
  }

  private setupUnlockListener(): void {
    const unlockHandler = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
    };

    window.addEventListener('pointerdown', unlockHandler, { once: true });
    window.addEventListener('keydown', unlockHandler, { once: true });
  }

  async unlock(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.isUnlocked) {
      this.isUnlocked = true;
      this.drone.start();
      this.weather.start();
      this.harmonizer.start();
    }
  }

  setMasterVolume(volume: number): void {
    this.userVolume = Math.max(0, Math.min(1, volume));
    if (!this.isMuted) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.userVolume, now, 0.05);
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    const now = this.ctx.currentTime;
    const target = muted ? 0.0001 : this.userVolume;
    this.masterGain.gain.setTargetAtTime(target, now, 0.05);
  }

  get muted(): boolean {
    return this.isMuted;
  }

  get volume(): number {
    return this.userVolume;
  }

  get state(): AudioContextState {
    return this.ctx.state;
  }

  async suspend(): Promise<void> {
    if (this.ctx.state === 'running') {
      await this.ctx.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  destroy(): void {
    this.drone.stop();
    this.weather.stop();
    this.harmonizer.stop();
    this.ctx.close();
  }
}

