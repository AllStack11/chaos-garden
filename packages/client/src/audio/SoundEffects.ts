/**
 * Chaos Garden - Parametric Micro-Chimes & Curator SFX
 *
 * 100% procedurally synthesized acoustic micro-cues using Web Audio oscillators
 * and fast exponential decay envelopes.
 */

export class SoundEffects {
  private ctx: AudioContext;
  private outputNode: GainNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 0.4;
    this.outputNode.connect(destination);
  }

  playBirth(): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playDeath(): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.start(now);
    osc.stop(now + 0.21);
  }

  playSpeciation(): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // 2-operator FM Synthesis for resonant bell chime
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const masterGain = this.ctx.createGain();

    carrier.frequency.value = 587.33; // D5
    modulator.frequency.value = 587.33 * 2; // 2x harmonic ratio
    modGain.gain.setValueAtTime(300, now);
    modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    masterGain.gain.setValueAtTime(0.2, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    carrier.connect(masterGain);
    masterGain.connect(this.outputNode);

    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + 0.85);
    modulator.stop(now + 0.85);
  }

  playWaterDrop(): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  playNutrientSparkle(): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const freqs = [1046.5, 1318.5, 1567.98]; // C6, E6, G6
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + i * 0.04;

      osc.type = 'sine';
      osc.frequency.value = f;

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(this.outputNode);

      osc.start(startTime);
      osc.stop(startTime + 0.11);
    });
  }

  playClick(): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 1200;

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.start(now);
    osc.stop(now + 0.04);
  }
}

