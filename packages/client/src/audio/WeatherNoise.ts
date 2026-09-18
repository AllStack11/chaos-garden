/**
 * Chaos Garden - Procedural Weather Noise Synthesizer
 *
 * Generates 100% synthetic wind and rain audio using white/pink noise buffers
 * routed through resonant multi-band BiquadFilterNodes. Zero audio files required.
 */

export class WeatherNoise {
  private ctx: AudioContext;
  private outputNode: GainNode;
  private noiseSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode;
  private rainFilter: BiquadFilterNode;
  private windGain: GainNode;
  private rainGain: GainNode;
  private isStarted = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 0.4;
    this.outputNode.connect(destination);

    // Wind filter: Resonant bandpass
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 450;
    this.windFilter.Q.value = 3.0;

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.15;
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.outputNode);

    // Rain filter: Highpass / high bandpass
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.frequency.value = 2400;
    this.rainFilter.Q.value = 1.0;

    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.0;
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.outputNode);
  }

  private createNoiseBuffer(): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const duration = 2.0; // 2-second looping noise buffer
    const bufferSize = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Pink noise generation using Paul Kellet's filter method
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    return buffer;
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    const buffer = this.createNoiseBuffer();
    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    this.noiseSource.connect(this.windFilter);
    this.noiseSource.connect(this.rainFilter);
    this.noiseSource.start();
  }

  setWeather(windIntensity: number, rainIntensity: number): void {
    const now = this.ctx.currentTime;
    const wind = Math.max(0, Math.min(1, windIntensity));
    const rain = Math.max(0, Math.min(1, rainIntensity));

    // Wind modulation
    const windFreq = 200 + wind * 600;
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.4);
    this.windGain.gain.setTargetAtTime(0.05 + wind * 0.25, now, 0.4);

    // Rain modulation
    this.rainGain.gain.setTargetAtTime(rain * 0.3, now, 0.3);
  }

  stop(): void {
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {}
      this.noiseSource = null;
    }
    this.isStarted = false;
  }
}

