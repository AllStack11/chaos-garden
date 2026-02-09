import type { QualityTier } from './types.ts';

const FRAME_HISTORY_SIZE = 60;

export class AdaptiveQualityController {
  private frameTimes: number[] = [];
  private qualityTier: QualityTier = 'high';

  recordFrame(frameDurationMs: number): QualityTier {
    this.frameTimes.push(frameDurationMs);
    if (this.frameTimes.length > FRAME_HISTORY_SIZE) {
      this.frameTimes.shift();
    }

    const averageFrame = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
    const averageFps = 1000 / Math.max(averageFrame, 1);

    if (averageFps < 45) {
      this.qualityTier = 'low';
    } else if (averageFps < 56) {
      this.qualityTier = 'medium';
    } else {
      this.qualityTier = 'high';
    }

    return this.qualityTier;
  }

  getQualityTier(): QualityTier {
    return this.qualityTier;
  }
}
