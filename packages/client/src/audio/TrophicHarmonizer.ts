/**
 * Chaos Garden - Trophic Chord Harmonizer
 *
 * Procedurally transitions musical chords and modes based on ecological kingdom balance.
 * Generates rich, ethereal evolving harmonic chords without digital assets.
 */

export class TrophicHarmonizer {
  private ctx: AudioContext;
  private outputNode: GainNode;
  private activeVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private isStarted = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.outputNode = ctx.createGain();
    this.outputNode.gain.value = 0.25;
    this.outputNode.connect(destination);
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    this.playChord([220, 277.18, 329.63, 440]); // A Major chord
  }

  /**
   * Adapts harmony to ecological ratios every few seconds.
   */
  updateHarmony(plantRatio: number, herbivoreRatio: number, carnivoreRatio: number): void {
    if (!this.isStarted) return;

    let frequencies: number[];

    if (carnivoreRatio > 0.3) {
      // Carnivore overpopulation: Diminished fifth tension (B, D, F, Ab)
      frequencies = [246.94, 293.66, 349.23, 415.3];
    } else if (plantRatio > 0.6) {
      // Flora dominant: Lydian mode, peaceful major intervals (F, A, C, E)
      frequencies = [174.61, 220.0, 261.63, 329.63];
    } else {
      // Balanced ecosystem: Dorian mode (D, F, A, C)
      frequencies = [146.83, 174.61, 220.0, 261.63];
    }

    this.transitionToChord(frequencies);
  }

  private transitionToChord(frequencies: number[]): void {
    const now = this.ctx.currentTime;

    // Fade out previous voices
    this.activeVoices.forEach((v) => {
      v.gain.gain.setTargetAtTime(0.0001, now, 1.2);
      setTimeout(() => {
        try {
          v.osc.stop();
          v.osc.disconnect();
        } catch {}
      }, 2500);
    });
    this.activeVoices = [];

    // Create new chord voices
    this.playChord(frequencies);
  }

  private playChord(frequencies: number[]): void {
    const now = this.ctx.currentTime;

    frequencies.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      // Gentle organic attack
      gain.gain.setTargetAtTime(0.06, now, 1.5);

      osc.connect(gain);
      gain.connect(this.outputNode);
      osc.start(now);

      this.activeVoices.push({ osc, gain });
    });
  }

  stop(): void {
    this.activeVoices.forEach((v) => {
      try {
        v.osc.stop();
        v.osc.disconnect();
      } catch {}
    });
    this.activeVoices = [];
    this.isStarted = false;
  }
}

