import type { QualityTier } from './types.ts';

const FRAME_HISTORY_SIZE = 60;

export class AdaptiveQualityController {
  private frameTimes: number[] = [];
  private qualityTier: QualityTier = 'high';
  private devModeOverride: boolean;

  constructor() {
    this.devModeOverride = this.detectDevMode();
  }

  private detectDevMode(): boolean {
    // Check for localhost
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.endsWith('.local');

      // Check for dev query parameter: ?dev=true or ?debug=true
      const searchParams = new URLSearchParams(window.location.search);
      const hasDevParam = searchParams.get('dev') === 'true' || searchParams.get('debug') === 'true';

      // Check for import.meta.env if available (Astro/Vite)
      const isViteDev = typeof import.meta !== 'undefined' &&
                        import.meta.env &&
                        import.meta.env.DEV === true;

      return isLocalhost || hasDevParam || isViteDev;
    }
    return false;
  }

  recordFrame(frameDurationMs: number): QualityTier {
    // If dev mode is active, always return high quality
    if (this.devModeOverride) {
      this.qualityTier = 'high';
      return this.qualityTier;
    }

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

  isDevMode(): boolean {
    return this.devModeOverride;
  }
}
