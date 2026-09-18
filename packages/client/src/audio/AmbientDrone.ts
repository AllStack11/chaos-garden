/**
 * Chaos Garden - Ambient Diurnal Drone Synthesizer
 *
 * Generates an organic, warm harmonic background drone using detuned oscillators.
 * Diurnal modulation dynamically adjusts filter cutoffs with sunlight (0.0 night -> 1.0 day).
 */

export class AmbientDrone {
  private ctx: AudioContext;
  private outputNode: GainNode;
  private filterNode: BiquadFilterNode;
  private oscillators: OscillatorNode[] = [];
  private isStarted = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 0.35;

    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 400;
    this.filterNode.Q.value = 2.0;

    this.filterNode.connect(this.outputNode);
    this.outputNode.connect(destination);
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    // Frequencies: A1 (55Hz), E2 (82.4Hz), A2 (110Hz)
    const baseFreqs = [55, 82.4, 110];

    baseFreqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      // Slight detuning (+/- 3 cents) for organic beating
      osc.detune.value = (idx - 1) * 3;

      const oscGain = this.ctx.createGain();
      oscGain.gain.value = 0.25;

      osc.connect(oscGain);
      oscGain.connect(this.filterNode);
      osc.start();
      this.oscillators.push(osc);
    });
  }

  /**
   * Modulates filter cutoff dynamically with sunlight (0.0 to 1.0).
   */
  setSunlight(sunlight: number): void {
    const clamped = Math.max(0, Math.min(1, sunlight));
    // Filter opens from 180 Hz (dark midnight) to 1200 Hz (bright noon)
    const targetFreq = 180 + clamped * 1020;
    const now = this.ctx.currentTime;
    this.filterNode.frequency.setTargetAtTime(targetFreq, now, 0.5);
  }

  stop(): void {
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.oscillators = [];
    this.isStarted = false;
  }
}

